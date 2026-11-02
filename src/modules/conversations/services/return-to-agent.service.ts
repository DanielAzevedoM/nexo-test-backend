import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../../entities/conversation.entity';
import { ConversationStatus } from '../../../enums/conversation-status.enum';
import { User } from '../../../entities/user.entity';
import { Message } from '../../../entities/message.entity';
import { MessageSender } from '../../../enums/message-sender.enum';

@Injectable()
export class ReturnToAgentService {
  private readonly logger = new Logger(ReturnToAgentService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  async execute(tenantId: string, analyst: User, conversationId: string) {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    conversation.status = ConversationStatus.WITH_AGENT;
    conversation.agentPaused = false;
    conversation.assignedAnalystId = null;
    conversation.lastMessageAt = new Date();

    await this.conversationRepo.save(conversation);

    const sysMsg = this.messageRepo.create({
      conversationId: conversation.id,
      sender: MessageSender.SYSTEM,
      content: `O atendimento foi devolvido ao Nexo Assist pelo analista ${analyst.name}.`,
    });
    await this.messageRepo.save(sysMsg);

    this.logger.log(`🤖 Conversation ${conversation.id} returned to agent by ${analyst.name}`);

    return {
      message: 'Atendimento devolvido ao assistente com sucesso.',
      conversation,
    };
  }
}

