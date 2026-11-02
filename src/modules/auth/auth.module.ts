import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { User } from '../../entities/user.entity';
import { AuthController } from './controllers/auth.controller';
import { LoginService } from './services/login.service';
import { GetMeService } from './services/get-me.service';
import { JwtStrategy } from '../../security/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'nexo_assist_secret_key_2026'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN', '7d')) as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [LoginService, GetMeService, JwtStrategy],
  exports: [LoginService, GetMeService, JwtModule, PassportModule],
})
export class AuthModule {}
