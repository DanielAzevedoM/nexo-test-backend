import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../../../entities/ticket.entity';
import { User } from '../../../entities/user.entity';
import { UserRole } from '../../../enums/user-role.enum';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { calculateSlaDeadline } from '../../../utils/sla.utils';
import { LegacyTicketSystemService } from './legacy-ticket-system.service';

@Injectable()
export class UpdateTicketService {
  private readonly logger = new Logger(UpdateTicketService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly legacyService: LegacyTicketSystemService,
  ) {}

  async execute(
    tenantId: string,
    currentUser: User,
    ticketId: string,
    dto: UpdateTicketDto,
  ) {
    return await this.legacyService.executeWithLegacyResilience('updateTicket', async () => {
      const ticket = await this.ticketRepository.findOne({
        where: { id: ticketId, tenantId },
      });

      if (!ticket) {
        throw new NotFoundException('Chamado não encontrado.');
      }

      // Regra de Privacidade
      if (currentUser.role === UserRole.EMPLOYEE && ticket.userId !== currentUser.id) {
        throw new ForbiddenException('Você não tem permissão para alterar este chamado.');
      }

      if (dto.title) ticket.title = dto.title;

      // Se nova descrição for informada, adiciona como complemento (User Story 3)
      if (dto.description) {
        ticket.description = `${ticket.description}\n\n[Atualização em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}]: ${dto.description}`;
      }

      if (dto.category) ticket.category = dto.category;

      if (dto.priority && dto.priority !== ticket.priority) {
        ticket.priority = dto.priority;
        ticket.slaDeadline = calculateSlaDeadline(dto.priority, ticket.createdAt);
      }

      if (dto.status) ticket.status = dto.status;
      if (dto.affectedScope) ticket.affectedScope = dto.affectedScope;
      if (dto.assignedAnalystId) ticket.assignedAnalystId = dto.assignedAnalystId;

      const saved = await this.ticketRepository.save(ticket);
      this.logger.log(`✏️ Ticket ${saved.code} updated by ${currentUser.email}`);

      return saved;
    });
  }
}

