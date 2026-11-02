import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../../../entities/ticket.entity';
import { User } from '../../../entities/user.entity';
import { UserRole } from '../../../enums/user-role.enum';
import { isTicketOverdue, formatSlaRemaining, formatDueEstimate } from '../../../utils/sla.utils';
import { LegacyTicketSystemService } from './legacy-ticket-system.service';

@Injectable()
export class GetTicketService {
  private readonly logger = new Logger(GetTicketService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly legacyService: LegacyTicketSystemService,
  ) {}

  async execute(tenantId: string, currentUser: User, identifier: string) {
    return await this.legacyService.executeWithLegacyResilience('getTicket', async () => {
      // Aceita tanto UUID quanto código (ex: INC-20311)
      const isUUID = identifier.includes('-');
      const isCode = identifier.toUpperCase().startsWith('INC-') || identifier.toUpperCase().startsWith('REQ-');

      const qb = this.ticketRepository
        .createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.user', 'user')
        .leftJoinAndSelect('ticket.assignedAnalyst', 'analyst')
        .where('ticket.tenantId = :tenantId', { tenantId });

      if (isCode) {
        qb.andWhere('UPPER(ticket.code) = :code', { code: identifier.toUpperCase() });
      } else {
        qb.andWhere('ticket.id = :id', { id: identifier });
      }

      const ticket = await qb.getOne();

      if (!ticket) {
        throw new NotFoundException(`Chamado "${identifier}" não encontrado.`);
      }

      // Regra de Privacidade (Anexo A):
      // "Privacidade: informações de um chamado só podem ser passadas a quem o abriu."
      if (currentUser.role === UserRole.EMPLOYEE && ticket.userId !== currentUser.id) {
        this.logger.warn(
          `🚫 Privacy violation attempt: User ${currentUser.email} tried to access ticket ${ticket.code} belonging to user ${ticket.userId}`,
        );
        throw new ForbiddenException('Você não tem permissão para visualizar informações deste chamado.');
      }

      const isOverdue = isTicketOverdue(ticket.slaDeadline);
      const slaInfo = formatSlaRemaining(ticket.slaDeadline);
      const dueEstimate = formatDueEstimate(ticket.priority);

      this.logger.log(`🔍 Retrieved ticket ${ticket.code} for user ${currentUser.email}`);

      return {
        ...ticket,
        isOverdue,
        slaRemainingText: slaInfo.text,
        dueEstimate,
      };
    });
  }
}

