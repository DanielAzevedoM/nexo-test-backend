import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../../entities/conversation.entity';
import { ConversationStatus } from '../../../enums/conversation-status.enum';
import { User } from '../../../entities/user.entity';
import { Message } from '../../../entities/message.entity';
import { Ticket } from '../../../entities/ticket.entity';
import { TicketStatus } from '../../../enums/ticket-status.enum';
import { MessageSender } from '../../../enums/message-sender.enum';

@Injectable()
export class AssignAnalystService {
  private readonly logger = new Logger(AssignAnalystService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async execute(tenantId: string, analyst: User, conversationId: string) {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, tenantId },
      relations: ['user', 'relatedTicket'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    conversation.status = ConversationStatus.IN_ATTENDANCE;
    conversation.assignedAnalystId = analyst.id;
    conversation.assignedAnalyst = analyst;
    conversation.agentPaused = true;
    conversation.lastMessageAt = new Date();

    // 1. Registra o analista responsável no chamado vinculado no banco de dados
    if (conversation.relatedTicketId) {
      const ticket = await this.ticketRepo.findOne({
        where: { id: conversation.relatedTicketId, tenantId },
      });
      if (ticket) {
        ticket.assignedAnalystId = analyst.id;
        if (
          ticket.status === TicketStatus.OPEN ||
          ticket.status === TicketStatus.WAITING_ANALYST
        ) {
          ticket.status = TicketStatus.IN_PROGRESS;
        }
        await this.ticketRepo.save(ticket);
        this.logger.log(
          `🎟️ Chamado ${ticket.code} atribuído com sucesso ao analista ${analyst.name} (${analyst.email}) no banco de dados.`,
        );
      }
    } else {
      // 2. Se a conversa não possuía relatedTicketId direto, vincula o chamado em aberto mais recente do usuário
      const activeTicket = await this.ticketRepo.findOne({
        where: [
          { tenantId, userId: conversation.userId, status: TicketStatus.WAITING_ANALYST },
          { tenantId, userId: conversation.userId, status: TicketStatus.OPEN },
        ],
        order: { updatedAt: 'DESC' },
      });

      if (activeTicket) {
        activeTicket.assignedAnalystId = analyst.id;
        activeTicket.status = TicketStatus.IN_PROGRESS;
        await this.ticketRepo.save(activeTicket);
        conversation.relatedTicketId = activeTicket.id;
        conversation.relatedTicket = activeTicket;
        this.logger.log(
          `🎟️ Chamado ativo ${activeTicket.code} vinculado à conversa e atribuído ao analista ${analyst.name} no banco de dados.`,
        );
      }
    }

    await this.conversationRepo.save(conversation);

    // Mensagem de sistema informando que o analista assumiu
    const sysMsg = this.messageRepo.create({
      conversationId: conversation.id,
      sender: MessageSender.SYSTEM,
      content: `O analista ${analyst.name} assumiu o atendimento e se responsabilizou pelo chamado. O assistente automático foi pausado.`,
    });
    await this.messageRepo.save(sysMsg);

    this.logger.log(`👤 Analyst ${analyst.name} assigned to conversation ${conversation.id}`);

    return {
      message: 'Atendimento assumido com sucesso. O assistente foi pausado.',
      conversation,
    };
  }
}

