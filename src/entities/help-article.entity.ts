import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TicketCategory } from '../enums/ticket-category.enum';

@Entity('help_articles')
export class HelpArticle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 50, default: 'nexo-corp' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: TicketCategory.OTHER,
  })
  category: TicketCategory;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tags?: string;

  @Column({ name: 'embedding', type: 'longtext', nullable: true })
  embeddingJson?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
