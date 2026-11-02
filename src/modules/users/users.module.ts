import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { UsersController } from './controllers/users.controller';
import { ListUsersService } from './services/list-users.service';
import { GetUserService } from './services/get-user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [ListUsersService, GetUserService],
  exports: [ListUsersService, GetUserService],
})
export class UsersModule {}

