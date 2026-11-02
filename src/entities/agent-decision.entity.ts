import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Message } from './message.entity';

@Entity('agent_decisions')
export class AgentDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'message_id', type: 'varchar', length: 50 })
  messageId: string;

  @OneToOne(() => Message, (message) => message.decision, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @Column({ name: 'conversation_id', type: 'varchar', length: 50 })
  conversationId: string;

  @Column({ type: 'varchar', length: 100 })
  intent: string; // e.g. "CHECK_TICKET_STATUS", "DRAFT_NEW_TICKET", "HELP_CENTER_QUERY", "ESCALATE_ANALYST"

  @Column({ type: 'int', default: 90 })
  confidence: number; // 0-100%

  @Column({ type: 'text' })
  reasoning: string; // Detailed narrative: what agent understood, why it chose this action

  @Column({ name: 'rules_applied', type: 'simple-json', nullable: true })
  rulesApplied?: string[]; // e.g. ["Prioridade Alta: compromisso no mesmo dia", "Sem duplicidade: checagem de VPN existente"]

  @Column({ name: 'tools_called', type: 'simple-json', nullable: true })
  toolsCalled?: Array<{
    name: string;
    description: string;
    params?: any;
    resultSummary?: string;
    latencyMs?: number;
  }>;

  @Column({ name: 'latency_ms', type: 'int', default: 0 })
  latencyMs: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
