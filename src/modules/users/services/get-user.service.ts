import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../entities/user.entity';

@Injectable()
export class GetUserService {
  private readonly logger = new Logger(GetUserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async execute(tenantId: string, id: string) {
    const user = await this.userRepository.findOne({
      where: { id, tenantId, isActive: true },
      select: ['id', 'name', 'email', 'department', 'role', 'avatarUrl', 'createdAt'],
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    this.logger.log(`🔍 Retrieved user ${user.id} (${user.email})`);

    return user;
  }
}

