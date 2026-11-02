import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../../entities/conversation.entity';
import { Message } from '../../entities/message.entity';
import { Ticket } from '../../entities/ticket.entity';
import { ConversationsController } from './controllers/conversations.controller';
import { CreateConversationService } from './services/create-conversation.service';
import { ListConversationsService } from './services/list-conversations.service';
import { GetConversationService } from './services/get-conversation.service';
import { AssignAnalystService } from './services/assign-analyst.service';
import { ReturnToAgentService } from './services/return-to-agent.service';
import { CloseConversationService } from './services/close-conversation.service';
import { SendAnalystMessageService } from './services/send-analyst-message.service';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, Ticket])],
  controllers: [ConversationsController],
  providers: [
    CreateConversationService,
    ListConversationsService,
    GetConversationService,
    AssignAnalystService,
    ReturnToAgentService,
    CloseConversationService,
    SendAnalystMessageService,
  ],
  exports: [
    CreateConversationService,
    ListConversationsService,
    GetConversationService,
    AssignAnalystService,
    ReturnToAgentService,
    CloseConversationService,
    SendAnalystMessageService,
  ],
})
export class ConversationsModule {}

