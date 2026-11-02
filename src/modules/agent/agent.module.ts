import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Conversation } from '../../entities/conversation.entity';
import { Message } from '../../entities/message.entity';
import { AgentDecision } from '../../entities/agent-decision.entity';
import { Ticket } from '../../entities/ticket.entity';
import { HelpArticle } from '../../entities/help-article.entity';
import { AgentController } from './controllers/agent.controller';
import { ProcessAgentMessageService } from './services/process-agent-message.service';
import { ConfirmDraftService } from './services/confirm-draft.service';
import { GetDecisionDetailsService } from './services/get-decision-details.service';
import { GeminiAgentService } from './services/gemini-agent.service';
import { TicketsModule } from '../tickets/tickets.module';
import { HelpCenterModule } from '../help-center/help-center.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Conversation,
      Message,
      AgentDecision,
      Ticket,
      HelpArticle,
    ]),
    TicketsModule,
    HelpCenterModule,
  ],
  controllers: [AgentController],
  providers: [
    ProcessAgentMessageService,
    ConfirmDraftService,
    GetDecisionDetailsService,
    GeminiAgentService,
  ],
  exports: [
    ProcessAgentMessageService,
    ConfirmDraftService,
    GetDecisionDetailsService,
    GeminiAgentService,
  ],
})
export class AgentModule {}

