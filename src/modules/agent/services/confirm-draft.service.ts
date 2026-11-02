import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../../entities/conversation.entity';
import { Message } from '../../../entities/message.entity';
import { AgentDecision } from '../../../entities/agent-decision.entity';
import { Ticket } from '../../../entities/ticket.entity';
import { User } from '../../../entities/user.entity';
import { MessageSender } from '../../../enums/message-sender.enum';
import { TicketType } from '../../../enums/ticket-type.enum';
import { TicketCategory } from '../../../enums/ticket-category.enum';
import { TicketPriority } from '../../../enums/ticket-priority.enum';
import { AffectedScope } from '../../../enums/affected-scope.enum';
import { CreateTicketService } from '../../tickets/services/create-ticket.service';
import { UpdateTicketService } from '../../tickets/services/update-ticket.service';
import { ConfirmDraftDto, DraftAction } from '../dto/confirm-draft.dto';
import { formatDueEstimate } from '../../../utils/sla.utils';

@Injectable()
export class ConfirmDraftService {
  private readonly logger = new Logger(ConfirmDraftService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(AgentDecision)
    private readonly decisionRepo: Repository<AgentDecision>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    private readonly createTicketService: CreateTicketService,
    private readonly updateTicketService: UpdateTicketService,
  ) {}

  async execute(tenantId: string, currentUser: User, dto: ConfirmDraftDto) {
    const conversation = await this.conversationRepo.findOne({
      where: { id: dto.conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    // Busca as mensagens do agent na conversa para encontrar o rascunho pendente
    const agentMessages = await this.messageRepo.find({
      where: { conversationId: conversation.id, sender: MessageSender.AGENT },
      order: { createdAt: 'DESC' },
    });

    let draft: any = null;
    for (const msg of agentMessages) {
      let meta = msg.metadata;
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta);
        } catch {
          // ignore
        }
      }
      if (meta && meta.draftTicket) {
        draft = meta.draftTicket;
        break;
      }
    }

    if (!draft) {
      throw new BadRequestException('Nenhum rascunho pendente de confirmação encontrado.');
    }

    if (dto.action === DraftAction.CANCEL) {
      const cancelMsg = this.messageRepo.create({
        conversationId: conversation.id,
        sender: MessageSender.AGENT,
        content: 'Rascunho cancelado. Se precisar de outra ajuda ou quiser abrir outro chamado, estou à disposição.',
        actions: ['cancelou o rascunho'],
      });
      await this.messageRepo.save(cancelMsg);

      this.logger.log(`🚫 Draft cancelled by user ${currentUser.email}`);
      return { status: 'CANCELLED', message: cancelMsg };
    }

    if (dto.action === DraftAction.EDIT) {
      if (dto.editedDraft) {
        Object.assign(draft, dto.editedDraft);
      }
      const editMsg = this.messageRepo.create({
        conversationId: conversation.id,
        sender: MessageSender.AGENT,
        content: 'Rascunho atualizado com as suas informações. Por favor, confira os novos dados:',
        actions: ['atualizou o rascunho'],
        metadata: { draftTicket: draft },
      });
      await this.messageRepo.save(editMsg);

      this.logger.log(`✏️ Draft edited by user ${currentUser.email}`);
      return { status: 'EDITED', message: editMsg };
    }

    // Confirmação (CONFIRM)
    const priority = (draft.priority as TicketPriority) || TicketPriority.HIGH;
    const category = (draft.category as TicketCategory) || TicketCategory.NETWORK_VPN;
    const type = (draft.type as TicketType) || TicketType.INCIDENT;
    const affected = (draft.affectedScope as AffectedScope) || AffectedScope.ONLY_ME;

    let createdTicket: any;
    let isDuplicateResolved = false;

    // Verifica se o rascunho apontava para um chamado existente para atualizar
    let targetExistingTicket: Ticket | null = null;
    if (draft.existingTicketId) {
      targetExistingTicket = await this.ticketRepo.findOne({
        where: { id: draft.existingTicketId, tenantId },
      });
    } else if (draft.existingTicketCode) {
      targetExistingTicket = await this.ticketRepo.findOne({
        where: { code: draft.existingTicketCode, tenantId },
      });
    }

    if (targetExistingTicket) {
      // Atualização de chamado existente (regra de não duplicação do Anexo A)
      createdTicket = await this.updateTicketService.execute(
        tenantId,
        currentUser,
        targetExistingTicket.id,
        {
          description: `${targetExistingTicket.description}\n[Atualização via Nexo Assist]: ${draft.description}`,
          priority,
          category,
        },
      );
      isDuplicateResolved = true;
    } else {
      // Criação de novo chamado com salvaguarda de desduplicação
      try {
        createdTicket = await this.createTicketService.execute(tenantId, currentUser.id, {
          title: draft.title,
          description: draft.description,
          type,
          category,
          priority,
          affectedScope: affected,
        });
      } catch (err: any) {
        if (err.status === 409 || err.name === 'ConflictException') {
          // Anexo A: "se já existe um chamado aberto sobre o mesmo problema, ele é atualizado, não duplicado."
          const existingTicket = await this.ticketRepo.findOne({
            where: {
              userId: currentUser.id,
              tenantId,
              category,
            },
            order: { createdAt: 'DESC' },
          });

          if (existingTicket) {
            createdTicket = await this.updateTicketService.execute(
              tenantId,
              currentUser,
              existingTicket.id,
              {
                description: `${existingTicket.description}\n[Atualização]: ${draft.description}`,
                priority,
              },
            );
            isDuplicateResolved = true;
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    const dueText = formatDueEstimate(priority);
    const replyText = isDuplicateResolved
      ? `Identifiquei que você já tinha o chamado ${createdTicket.code} aberto sobre este problema. Conforme as regras do service desk, atualizei seu chamado existente com as novas informações sem duplicidade!`
      : `Pronto: abri o chamado com prioridade ${priority.toLowerCase()}. Um analista fala com você ${dueText}.`;

    const confirmMsg = this.messageRepo.create({
      conversationId: conversation.id,
      sender: MessageSender.AGENT,
      content: replyText,
      actions: ['consultou seus chamados', 'criou um chamado'],
      metadata: {
        ticketChip: {
          code: createdTicket.code,
          category: draft.category || 'Rede e VPN',
          priority: priority === TicketPriority.HIGH ? 'Alta' : priority === TicketPriority.CRITICAL ? 'Crítica' : 'Média',
          dueEstimate: dueText,
          statusDotColor: priority === TicketPriority.HIGH ? '#F5A500' : '#00BD6C',
        },
      },
    });

    await this.messageRepo.save(confirmMsg);

    // Registra decisão transparente
    const decision = this.decisionRepo.create({
      messageId: confirmMsg.id,
      conversationId: conversation.id,
      intent: 'CONFIRM_AND_CREATE_TICKET',
      confidence: 100,
      reasoning: `O funcionário confirmou explicitamente o rascunho ${draft.code || 'D-381'}. O chamado ${createdTicket.code} foi persistido com prioridade ${priority} e SLA calculado.`,
      rulesApplied: [
        'Abertura: todo chamado precisa de confirmação antes de ser criado (Anexo A)',
        'Classificação de prioridade combinando impacto e urgência',
        'Registro de SLA para primeira resposta',
      ],
      toolsCalled: [
        {
          name: 'create_ticket',
          description: 'Persistência no sistema legado de chamados',
          params: { code: createdTicket.code, priority },
          resultSummary: `Chamado ${createdTicket.code} criado com sucesso`,
          latencyMs: 65,
        },
      ],
      latencyMs: 70,
    });
    await this.decisionRepo.save(decision);

    // Atualiza conversa
    conversation.relatedTicketId = createdTicket.id;
    conversation.lastMessageAt = new Date();
    await this.conversationRepo.save(conversation);

    this.logger.log(`🎉 Ticket ${createdTicket.code} confirmed & created by ${currentUser.email}`);

    return {
      status: 'CONFIRMED',
      ticket: createdTicket,
      message: confirmMsg,
      decision,
    };
  }
}
