import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { TicketType } from '../enums/ticket-type.enum';
import { TicketCategory } from '../enums/ticket-category.enum';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { AffectedScope } from '../enums/affected-scope.enum';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  code: string; // e.g. INC-20311, REQ-10442

  @Column({ name: 'tenant_id', type: 'varchar', length: 50, default: 'nexo-corp' })
  tenantId: string;

  @Column({ name: 'user_id', type: 'varchar', length: 50 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'varchar',
    length: 20,
    default: TicketType.INCIDENT,
  })
  type: TicketType;

  @Column({
    type: 'varchar',
    length: 30,
    default: TicketCategory.OTHER,
  })
  category: TicketCategory;

  @Column({
    type: 'varchar',
    length: 20,
    default: TicketPriority.MEDIUM,
  })
  priority: TicketPriority;

  @Column({
    type: 'varchar',
    length: 30,
    default: TicketStatus.OPEN,
  })
  status: TicketStatus;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    name: 'affected_scope',
    type: 'varchar',
    length: 30,
    default: AffectedScope.ONLY_ME,
  })
  affectedScope: AffectedScope;

  @Column({ name: 'sla_deadline', type: 'datetime', nullable: true })
  slaDeadline?: Date;

  @Column({ name: 'assigned_analyst_id', type: 'varchar', length: 50, nullable: true })
  assignedAnalystId?: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_analyst_id' })
  assignedAnalyst?: User;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
