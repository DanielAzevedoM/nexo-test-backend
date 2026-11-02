import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../entities/user.entity';

@Injectable()
export class ListUsersService {
  private readonly logger = new Logger(ListUsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async execute(tenantId: string) {
    const users = await this.userRepository.find({
      where: { tenantId, isActive: true },
      order: { name: 'ASC' },
      select: ['id', 'name', 'email', 'department', 'role', 'avatarUrl', 'createdAt'],
    });

    this.logger.log(`📋 Found ${users.length} users for tenant ${tenantId}`);

    return users;
  }
}

