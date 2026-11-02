import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../entities/user.entity';

@Injectable()
export class GetMeService {
  private readonly logger = new Logger(GetMeService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    this.logger.log(`🔍 Retrieved profile for user: ${user.email}`);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  }
}

