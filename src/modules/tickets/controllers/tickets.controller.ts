import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateTicketService } from '../services/create-ticket.service';
import { ListTicketsService } from '../services/list-tickets.service';
import { GetTicketService } from '../services/get-ticket.service';
import { UpdateTicketService } from '../services/update-ticket.service';
import { ReopenTicketService } from '../services/reopen-ticket.service';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { FilterTicketsDto } from '../dto/filter-tickets.dto';
import { User } from '../../../entities/user.entity';
import {
  TicketCreateResponse,
  TicketListResponse,
} from '../../../docs/swagger/tickets/tickets.responses';

@ApiTags('Chamados')
@Controller('tickets')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class TicketsController {
  constructor(
    private readonly createTicketService: CreateTicketService,
    private readonly listTicketsService: ListTicketsService,
    private readonly getTicketService: GetTicketService,
    private readonly updateTicketService: UpdateTicketService,
    private readonly reopenTicketService: ReopenTicketService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar novo chamado' })
  @ApiResponse(TicketCreateResponse)
  create(@Request() req: { user: User }, @Body() dto: CreateTicketDto) {
    return this.createTicketService.execute(req.user.tenantId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar chamados (filtrado por usuário para funcionários)' })
  @ApiResponse(TicketListResponse)
  findAll(@Request() req: { user: User }, @Query() filters: FilterTicketsDto) {
    return this.listTicketsService.execute(req.user.tenantId, req.user, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar chamado por ID ou código (ex: INC-20311)' })
  findOne(@Request() req: { user: User }, @Param('id') id: string) {
    return this.getTicketService.execute(req.user.tenantId, req.user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar chamado ou complementar informações' })
  update(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.updateTicketService.execute(req.user.tenantId, req.user, id, dto);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reabrir chamado resolvido em até 7 dias' })
  reopen(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.reopenTicketService.execute(req.user.tenantId, req.user, id, reason);
  }
}

