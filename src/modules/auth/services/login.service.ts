import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../../entities/user.entity';
import { UserRole } from '../../../enums/user-role.enum';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LoginService {
  private readonly logger = new Logger(LoginService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: LoginDto) {
    const emailNormalized = dto.email.trim().toLowerCase();

    // Busca usuário pelo e-mail
    let user = await this.userRepository.findOne({
      where: { email: emailNormalized },
    });

    // Conforme o PRD (Item 1 - Login):
    // "aceitando os funcionários dos seus dados de exemplo com qualquer senha"
    if (!user) {
      // Se for domínio corporativo Nexo, cria automaticamente para flexibilidade de testes
      if (emailNormalized.endsWith('@nexo.com.br')) {
        const username = emailNormalized.split('@')[0];
        const formattedName = username
          .split('.')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');

        user = this.userRepository.create({
          tenantId: 'nexo-corp',
          email: emailNormalized,
          name: formattedName,
          role: emailNormalized.includes('analista') || emailNormalized.includes('roberto')
            ? UserRole.ANALYST
            : UserRole.EMPLOYEE,
          department: 'Geral',
          isActive: true,
        });

        await this.userRepository.save(user);
        this.logger.log(`👤 Auto-provisioned corporate user: ${user.email} (${user.role})`);
      } else {
        throw new UnauthorizedException(
          'E-mail corporativo não encontrado. Utilize seu e-mail @nexo.com.br.',
        );
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuário inativo no sistema.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const token = this.jwtService.sign(payload);

    this.logger.log(`✅ User logged in: ${user.email} [${user.role}]`);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }
}

