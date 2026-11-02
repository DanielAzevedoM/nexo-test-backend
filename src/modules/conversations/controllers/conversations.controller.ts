import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { UserRole } from '../../../enums/user-role.enum';
import { CreateConversationService } from '../services/create-conversation.service';
import { ListConversationsService } from '../services/list-conversations.service';
import { GetConversationService } from '../services/get-conversation.service';
import { AssignAnalystService } from '../services/assign-analyst.service';
import { ReturnToAgentService } from '../services/return-to-agent.service';
import { CloseConversationService } from '../services/close-conversation.service';
import { SendAnalystMessageService } from '../services/send-analyst-message.service';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { FilterConversationsDto } from '../dto/filter-conversations.dto';
import { SendAnalystMessageDto } from '../dto/send-analyst-message.dto';
import { User } from '../../../entities/user.entity';
import { ConversationListResponse } from '../../../docs/swagger/conversations/conversations.responses';

@ApiTags('Conversas')
@Controller('conversations')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ConversationsController {
  constructor(
    private readonly createConversationService: CreateConversationService,
    private readonly listConversationsService: ListConversationsService,
    private readonly getConversationService: GetConversationService,
    private readonly assignAnalystService: AssignAnalystService,
    private readonly returnToAgentService: ReturnToAgentService,
    private readonly closeConversationService: CloseConversationService,
    private readonly sendAnalystMessageService: SendAnalystMessageService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Iniciar ou retomar conversa ativa' })
  create(@Request() req: { user: User }, @Body() dto: CreateConversationDto) {
    return this.createConversationService.execute(
      req.user.tenantId,
      req.user.id,
      dto.relatedTicketId,
      dto.forceNew,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar conversas para o console do analista' })
  @ApiResponse(ConversationListResponse)
  findAll(@Request() req: { user: User }, @Query() filters: FilterConversationsDto) {
    return this.listConversationsService.execute(req.user.tenantId, req.user.id, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter histórico e detalhes de uma conversa' })
  findOne(@Request() req: { user: User }, @Param('id') id: string) {
    return this.getConversationService.execute(req.user.tenantId, id, req.user);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Analista assume atendimento da conversa (pausa o assistente)' })
  assign(@Request() req: { user: User }, @Param('id') id: string) {
    return this.assignAnalystService.execute(req.user.tenantId, req.user, id);
  }

  @Post(':id/return-to-agent')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Devolver conversa ao assistente Nexo Assist' })
  returnToAgent(@Request() req: { user: User }, @Param('id') id: string) {
    return this.returnToAgentService.execute(req.user.tenantId, req.user, id);
  }

  @Post(':id/close')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Encerrar conversa' })
  close(@Request() req: { user: User }, @Param('id') id: string) {
    return this.closeConversationService.execute(req.user.tenantId, req.user, id);
  }

  @Post(':id/analyst-message')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALYST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Enviar mensagem como analista' })
  sendAnalystMessage(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() dto: SendAnalystMessageDto,
  ) {
    return this.sendAnalystMessageService.execute(req.user.tenantId, req.user, id, dto);
  }
}
