import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../../entities/conversation.entity';
import { ConversationStatus } from '../../../enums/conversation-status.enum';
import { FilterConversationsDto } from '../dto/filter-conversations.dto';

@Injectable()
export class ListConversationsService {
  private readonly logger = new Logger(ListConversationsService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
  ) {}

  async execute(tenantId: string, currentAnalystId: string, filters?: FilterConversationsDto) {
    const qb = this.conversationRepo
      .createQueryBuilder('conv')
      .leftJoinAndSelect('conv.user', 'user')
      .leftJoinAndSelect('conv.assignedAnalyst', 'analyst')
      .leftJoinAndSelect('conv.relatedTicket', 'ticket')
      .leftJoinAndSelect('conv.messages', 'messages')
      .where('conv.tenantId = :tenantId', { tenantId });

    // Filtros de aba do console do analista (Telas 4 e 5)
    const tab = filters?.tab || 'all';

    if (tab === 'needs_human') {
      qb.andWhere('conv.status = :status', { status: ConversationStatus.WAITING_HUMAN });
    } else if (tab === 'with_agent') {
      qb.andWhere('conv.status = :status', { status: ConversationStatus.WITH_AGENT });
    } else if (tab === 'my_chats') {
      qb.andWhere('conv.assignedAnalystId = :analystId', { analystId: currentAnalystId });
    }

    if (filters?.search && filters.search.trim()) {
      const term = `%${filters.search.toLowerCase().trim()}%`;
      qb.andWhere(
        '(LOWER(user.name) LIKE :term OR LOWER(user.email) LIKE :term OR LOWER(conv.transferReason) LIKE :term OR LOWER(ticket.code) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('conv.lastMessageAt', 'DESC');

    const conversations = await qb.getMany();

    // Contadores gerais para as abas do console
    const [allCount, needsHumanCount, withAgentCount, myChatsCount] = await Promise.all([
      this.conversationRepo.count({ where: { tenantId } }),
      this.conversationRepo.count({
        where: { tenantId, status: ConversationStatus.WAITING_HUMAN },
      }),
      this.conversationRepo.count({
        where: { tenantId, status: ConversationStatus.WITH_AGENT },
      }),
      this.conversationRepo.count({
        where: { tenantId, assignedAnalystId: currentAnalystId },
      }),
    ]);

    // Formata o último texto de mensagem e dados para o frontend
    const formatted = conversations.map((conv) => {
      const sortedMessages = (conv.messages || []).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const lastMsg = sortedMessages[sortedMessages.length - 1];

      return {
        id: conv.id,
        status: conv.status,
        agentPaused: conv.agentPaused,
        messageCount: conv.messageCount,
        transferReason: conv.transferReason,
        transferSummary: conv.transferSummary,
        lastMessageAt: conv.lastMessageAt,
        user: conv.user,
        assignedAnalyst: conv.assignedAnalyst,
        relatedTicket: conv.relatedTicket,
        lastMessage: lastMsg ? {
          content: lastMsg.content,
          sender: lastMsg.sender,
          createdAt: lastMsg.createdAt,
        } : null,
      };
    });

    this.logger.log(`📋 Listed ${conversations.length} conversations (tab: ${tab})`);

    return {
      data: formatted,
      counts: {
        all: allCount,
        needsHuman: needsHumanCount,
        withAgent: withAgentCount,
        myChats: myChatsCount,
      },
    };
  }
}

