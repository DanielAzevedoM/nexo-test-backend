import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LoginService } from '../services/login.service';
import { GetMeService } from '../services/get-me.service';
import { LoginDto } from '../dto/login.dto';
import { User } from '../../../entities/user.entity';
import {
  AuthLoginResponse,
  AuthGetMeResponse,
} from '../../../docs/swagger/auth/auth.responses';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginService: LoginService,
    private readonly getMeService: GetMeService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Login com e-mail corporativo' })
  @ApiResponse(AuthLoginResponse)
  login(@Body() dto: LoginDto) {
    return this.loginService.execute(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter dados do usuário atual' })
  @ApiResponse(AuthGetMeResponse)
  getMe(@Request() req: { user: User }) {
    return this.getMeService.execute(req.user.id);
  }
}

