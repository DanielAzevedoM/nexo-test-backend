import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { MessageSender } from '../enums/message-sender.enum';
import { AgentDecision } from './agent-decision.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'varchar', length: 50 })
  conversationId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({
    type: 'varchar',
    length: 20,
    default: MessageSender.USER,
  })
  sender: MessageSender;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'simple-json', nullable: true })
  actions?: string[]; // e.g. ["consultou seus chamados", "classificou a prioridade"]

  @Column({ type: 'simple-json', nullable: true })
  metadata?: {
    quickReplies?: string[];
    draftTicket?: {
      code?: string;
      title: string;
      description: string;
      category: string;
      type: string;
      priority: string;
      affectedScope: string;
      dueEstimate?: string;
      existingTicketId?: string; // if updating duplicate
    };
    ticketChip?: {
      code: string;
      category: string;
      priority: string;
      dueEstimate: string;
      statusDotColor: string;
    };
    ticketSelectionList?: Array<{
      id: string;
      code: string;
      title: string;
      status: string;
      statusColor: string;
      dateFormatted: string;
    }>;
    ticketCard?: {
      id: string;
      code: string;
      title: string;
      description: string;
      category: string;
      priority: string;
      status: string;
      openedAt: string;
      lastUpdatedAt: string;
      isOverdue: boolean;
      overdueText?: string;
    };
    decisionId?: string;
    [key: string]: any;
  };

  @OneToOne(() => AgentDecision, (decision) => decision.message, { nullable: true })
  decision?: AgentDecision;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
