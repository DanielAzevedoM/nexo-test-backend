import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProcessAgentMessageService } from '../services/process-agent-message.service';
import { ConfirmDraftService } from '../services/confirm-draft.service';
import { GetDecisionDetailsService } from '../services/get-decision-details.service';
import { ChatMessageDto } from '../dto/chat-message.dto';
import { ConfirmDraftDto } from '../dto/confirm-draft.dto';
import { User } from '../../../entities/user.entity';

@ApiTags('Agente Nexo Assist')
@Controller('agent')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class AgentController {
  constructor(
    private readonly processMessageService: ProcessAgentMessageService,
    private readonly confirmDraftService: ConfirmDraftService,
    private readonly getDecisionDetailsService: GetDecisionDetailsService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Enviar mensagem para o Nexo Assist e receber resposta com ações' })
  chat(@Request() req: { user: User }, @Body() dto: ChatMessageDto) {
    return this.processMessageService.execute(req.user.tenantId, req.user, dto);
  }

  @Post('confirm-draft')
  @ApiOperation({ summary: 'Confirmar, editar ou cancelar rascunho de chamado gerado pelo assistente' })
  confirmDraft(@Request() req: { user: User }, @Body() dto: ConfirmDraftDto) {
    return this.confirmDraftService.execute(req.user.tenantId, req.user, dto);
  }

  @Get('decision/:id')
  @ApiOperation({ summary: 'Consultar detalhes de transparência de uma decisão do assistente' })
  getDecision(@Param('id') id: string) {
    return this.getDecisionDetailsService.execute(id);
  }
}

