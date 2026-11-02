import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../../entities/conversation.entity';
import { Message } from '../../../entities/message.entity';
import { User } from '../../../entities/user.entity';
import { UserRole } from '../../../enums/user-role.enum';

@Injectable()
export class GetConversationService {
  private readonly logger = new Logger(GetConversationService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  async execute(tenantId: string, id: string, currentUser?: User) {
    const conversation = await this.conversationRepo.findOne({
      where: { id, tenantId },
      relations: ['user', 'assignedAnalyst', 'relatedTicket', 'relatedTicket.assignedAnalyst'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    // Regra de Privacidade (Anexo A): Um funcionário só pode acessar a sua própria conversa
    if (currentUser && currentUser.role === UserRole.EMPLOYEE && conversation.userId !== currentUser.id) {
      throw new ForbiddenException('Você não tem permissão para visualizar esta conversa.');
    }

    const messages = await this.messageRepo.find({
      where: { conversationId: id },
      order: { createdAt: 'ASC' },
      relations: ['decision'],
    });

    this.logger.log(`🔍 Retrieved conversation ${id} with ${messages.length} messages`);

    return {
      ...conversation,
      messages,
    };
  }
}

