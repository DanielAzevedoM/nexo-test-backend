import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../../entities/conversation.entity';
import { ConversationStatus } from '../../../enums/conversation-status.enum';
import { Message } from '../../../entities/message.entity';
import { MessageSender } from '../../../enums/message-sender.enum';
import { User } from '../../../entities/user.entity';
import { SendAnalystMessageDto } from '../dto/send-analyst-message.dto';

@Injectable()
export class SendAnalystMessageService {
  private readonly logger = new Logger(SendAnalystMessageService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  async execute(
    tenantId: string,
    analyst: User,
    conversationId: string,
    dto: SendAnalystMessageDto,
  ) {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    if (conversation.status === ConversationStatus.CLOSED) {
      throw new BadRequestException('Esta conversa já está encerrada.');
    }

    // Se a conversa não estava com o analista, atribui a ele automaticamente
    if (conversation.status !== ConversationStatus.IN_ATTENDANCE) {
      conversation.status = ConversationStatus.IN_ATTENDANCE;
      conversation.assignedAnalystId = analyst.id;
      conversation.agentPaused = true;
    }

    conversation.messageCount = (conversation.messageCount || 0) + 1;
    conversation.lastMessageAt = new Date();
    await this.conversationRepo.save(conversation);

    const message = this.messageRepo.create({
      conversationId: conversation.id,
      sender: MessageSender.ANALYST,
      content: dto.content,
    });

    await this.messageRepo.save(message);

    this.logger.log(`💬 Analyst ${analyst.name} sent message in conv ${conversation.id}`);

    return message;
  }
}

