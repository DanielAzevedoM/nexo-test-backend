import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Entities
import { User } from './entities/user.entity';
import { Ticket } from './entities/ticket.entity';
import { HelpArticle } from './entities/help-article.entity';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { AgentDecision } from './entities/agent-decision.entity';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HelpCenterModule } from './modules/help-center/help-center.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { AgentModule } from './modules/agent/agent.module';

// Seed
import { runSeed } from './scripts/seed';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get<string>('DB_TYPE', 'mysql');

        if (dbType === 'mysql') {
          return {
            type: 'mysql',
            host: configService.get<string>('DB_HOST', 'localhost'),
            port: configService.get<number>('DB_PORT', 3306),
            username: configService.get<string>('DB_USERNAME', 'root'),
            password: configService.get<string>('DB_PASSWORD', 'root'),
            database: configService.get<string>('DB_DATABASE', 'nexo_assist'),
            charset: 'utf8mb4',
            entities: [User, Ticket, HelpArticle, Conversation, Message, AgentDecision],
            synchronize: true,
          };
        }

        // SQLite padrão para execução local imediata sem necessidade de docker ou servidor externo
        return {
          type: 'sqlite',
          database: configService.get<string>('DB_FILE', './nexo_database.sqlite'),
          entities: [User, Ticket, HelpArticle, Conversation, Message, AgentDecision],
          synchronize: true,
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    HelpCenterModule,
    TicketsModule,
    ConversationsModule,
    AgentModule,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    // Executa auto-seed na inicialização para garantir dados de exemplo (Anexo B)
    try {
      await runSeed(this.dataSource);
    } catch (err: any) {
      console.warn('⚠️ Auto-seed note:', err.message);
    }
  }
}

