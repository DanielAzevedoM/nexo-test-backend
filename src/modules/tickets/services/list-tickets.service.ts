import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../../../entities/ticket.entity';
import { User } from '../../../entities/user.entity';
import { UserRole } from '../../../enums/user-role.enum';
import { FilterTicketsDto } from '../dto/filter-tickets.dto';
import { isTicketOverdue, formatSlaRemaining, formatDueEstimate } from '../../../utils/sla.utils';
import { LegacyTicketSystemService } from './legacy-ticket-system.service';

@Injectable()
export class ListTicketsService {
  private readonly logger = new Logger(ListTicketsService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly legacyService: LegacyTicketSystemService,
  ) {}

  async execute(tenantId: string, currentUser: User, filters?: FilterTicketsDto) {
    return await this.legacyService.executeWithLegacyResilience('listTickets', async () => {
      const qb = this.ticketRepository
        .createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.user', 'user')
        .leftJoinAndSelect('ticket.assignedAnalyst', 'analyst')
        .where('ticket.tenantId = :tenantId', { tenantId });

      // Regra de Privacidade (Anexo A):
      // "Privacidade: informações de um chamado só podem ser passadas a quem o abriu."
      if (currentUser.role === UserRole.EMPLOYEE) {
        qb.andWhere('ticket.userId = :userId', { userId: currentUser.id });
      } else if (filters?.userId) {
        qb.andWhere('ticket.userId = :userId', { userId: filters.userId });
      }

      if (filters?.status) {
        qb.andWhere('ticket.status = :status', { status: filters.status });
      }

      if (filters?.category) {
        qb.andWhere('ticket.category = :category', { category: filters.category });
      }

      if (filters?.priority) {
        qb.andWhere('ticket.priority = :priority', { priority: filters.priority });
      }

      if (filters?.type) {
        qb.andWhere('ticket.type = :type', { type: filters.type });
      }

      if (filters?.search && filters.search.trim()) {
        const term = `%${filters.search.toLowerCase().trim()}%`;
        qb.andWhere(
          '(LOWER(ticket.code) LIKE :term OR LOWER(ticket.title) LIKE :term OR LOWER(ticket.description) LIKE :term)',
          { term },
        );
      }

      qb.orderBy('ticket.createdAt', 'DESC');

      const tickets = await qb.getMany();

      // Enriquecimento com SLA e cálculo de atraso
      const now = new Date();
      const enriched = tickets.map((t) => {
        const isOverdue = isTicketOverdue(t.slaDeadline);
        const slaInfo = formatSlaRemaining(t.slaDeadline);
        const dueEstimate = formatDueEstimate(t.priority);

        return {
          ...t,
          isOverdue,
          slaRemainingText: slaInfo.text,
          dueEstimate,
        };
      });

      const finalTickets = filters?.overdueOnly
        ? enriched.filter((t) => t.isOverdue)
        : enriched;

      this.logger.log(
        `📋 Listed ${finalTickets.length} tickets for user ${currentUser.email} [${currentUser.role}]`,
      );

      return {
        data: finalTickets,
        total: finalTickets.length,
      };
    });
  }
}

