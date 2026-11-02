import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ListUsersService } from '../services/list-users.service';
import { GetUserService } from '../services/get-user.service';
import { User } from '../../../entities/user.entity';

@ApiTags('Usuários')
@Controller('users')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly listUsersService: ListUsersService,
    private readonly getUserService: GetUserService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuários da organização' })
  findAll(@Request() req: { user: User }) {
    return this.listUsersService.execute(req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  findOne(@Request() req: { user: User }, @Param('id') id: string) {
    return this.getUserService.execute(req.user.tenantId, id);
  }
}

