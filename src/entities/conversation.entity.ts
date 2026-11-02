import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Ticket } from './ticket.entity';
import { ConversationStatus } from '../enums/conversation-status.enum';
import { Message } from './message.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 50, default: 'nexo-corp' })
  tenantId: string;

  @Column({ name: 'user_id', type: 'varchar', length: 50 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'varchar',
    length: 30,
    default: ConversationStatus.WITH_AGENT,
  })
  status: ConversationStatus;

  @Column({ name: 'assigned_analyst_id', type: 'varchar', length: 50, nullable: true })
  assignedAnalystId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_analyst_id' })
  assignedAnalyst?: User;

  @Column({ name: 'related_ticket_id', type: 'varchar', length: 50, nullable: true })
  relatedTicketId?: string;

  @ManyToOne(() => Ticket, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'related_ticket_id' })
  relatedTicket?: Ticket;

  @Column({ name: 'transfer_reason', type: 'varchar', nullable: true, length: 255 })
  transferReason?: string;

  @Column({ name: 'transfer_summary', type: 'text', nullable: true })
  transferSummary?: string;

  @Column({ name: 'agent_paused', type: 'boolean', default: false })
  agentPaused: boolean;

  @Column({ name: 'message_count', type: 'int', default: 0 })
  messageCount: number;

  @Column({ name: 'last_message_at', type: 'datetime', nullable: true })
  lastMessageAt?: Date;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
