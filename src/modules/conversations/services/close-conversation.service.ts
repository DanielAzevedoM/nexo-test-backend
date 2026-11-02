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
export class CloseConversationService {
  private readonly logger = new Logger(CloseConversationService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async execute(tenantId: string, currentUser: User, conversationId: string) {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, tenantId },
      relations: ['relatedTicket'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    conversation.status = ConversationStatus.CLOSED;
    conversation.lastMessageAt = new Date();

    // Se houver chamado vinculado, encerra o chamado no banco
    if (conversation.relatedTicketId) {
      const ticket = await this.ticketRepo.findOne({
        where: { id: conversation.relatedTicketId, tenantId },
      });
      if (
        ticket &&
        ticket.status !== TicketStatus.RESOLVED &&
        ticket.status !== TicketStatus.CANCELLED
      ) {
        ticket.status = TicketStatus.RESOLVED;
        ticket.closedAt = new Date();
        await this.ticketRepo.save(ticket);
        this.logger.log(`🎟️ Chamado ${ticket.code} marcado como RESOLVIDO no banco de dados`);
      }
    }

    await this.conversationRepo.save(conversation);

    const sysMsg = this.messageRepo.create({
      conversationId: conversation.id,
      sender: MessageSender.SYSTEM,
      content: `Atendimento encerrado por ${currentUser.name}. Se precisar de ajuda novamente, basta iniciar uma nova conversa.`,
    });
    await this.messageRepo.save(sysMsg);

    this.logger.log(`🏁 Conversation ${conversation.id} closed by ${currentUser.name}`);

    return {
      message: 'Conversa encerrada com sucesso.',
      conversation,
    };
  }
}

