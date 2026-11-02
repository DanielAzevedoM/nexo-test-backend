import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from '../enums/user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 50, default: 'nexo-corp' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ unique: true, type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department?: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: UserRole.EMPLOYEE,
  })
  role: UserRole;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true, length: 255 })
  passwordHash?: string;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true, length: 500 })
  avatarUrl?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
