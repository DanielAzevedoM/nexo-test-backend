import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../../entities/conversation.entity';
import { ConversationStatus } from '../../../enums/conversation-status.enum';
import { Message } from '../../../entities/message.entity';
import { MessageSender } from '../../../enums/message-sender.enum';

@Injectable()
export class CreateConversationService {
  private readonly logger = new Logger(CreateConversationService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  async execute(tenantId: string, userId: string, relatedTicketId?: string, forceNew = false) {
    // User Story 6: "Voltar outro dia e continuar de onde parei."
    // Busca se o usuário já possui uma conversa ativa (não encerrada) caso não forçar nova
    if (!forceNew) {
      const existingActive = await this.conversationRepo.findOne({
        where: [
          { tenantId, userId, status: ConversationStatus.WITH_AGENT },
          { tenantId, userId, status: ConversationStatus.WAITING_HUMAN },
          { tenantId, userId, status: ConversationStatus.IN_ATTENDANCE },
        ],
        order: { updatedAt: 'DESC' },
        relations: ['messages', 'user', 'relatedTicket'],
      });

      if (existingActive) {
        this.logger.log(`🔄 Resumed existing conversation ${existingActive.id} for user ${userId}`);
        return existingActive;
      }
    }

    // Cria nova conversa
    const conversation = this.conversationRepo.create({
      tenantId,
      userId,
      status: ConversationStatus.WITH_AGENT,
      relatedTicketId,
      agentPaused: false,
      messageCount: 0,
      lastMessageAt: new Date(),
    });

    await this.conversationRepo.save(conversation);

    // Mensagem inicial de boas-vindas do Nexo Assist
    const welcomeMessage = this.messageRepo.create({
      conversationId: conversation.id,
      sender: MessageSender.AGENT,
      content: 'Olá! Sou o Nexo Assist, seu assistente do service desk de TI. Descreva o que está acontecendo e eu consulto seus chamados, busco soluções na central de ajuda ou chamo um analista se precisar.',
      actions: ['iniciou o atendimento'],
      metadata: {
        quickReplies: [
          'Meu notebook não conecta na VPN',
          'Qual o status do meu chamado?',
          'Preciso de um novo equipamento',
          'Falar com um analista',
        ],
      },
    });

    await this.messageRepo.save(welcomeMessage);

    this.logger.log(`✨ Created new conversation ${conversation.id} for user ${userId}`);

    return conversation;
  }
}
