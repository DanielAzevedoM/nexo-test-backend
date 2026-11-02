import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../../../entities/ticket.entity';
import { User } from '../../../entities/user.entity';
import { UserRole } from '../../../enums/user-role.enum';
import { TicketStatus } from '../../../enums/ticket-status.enum';
import { LegacyTicketSystemService } from './legacy-ticket-system.service';

@Injectable()
export class ReopenTicketService {
  private readonly logger = new Logger(ReopenTicketService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly legacyService: LegacyTicketSystemService,
  ) {}

  async execute(tenantId: string, currentUser: User, ticketId: string, reason?: string) {
    return await this.legacyService.executeWithLegacyResilience('reopenTicket', async () => {
      const ticket = await this.ticketRepository.findOne({
        where: { id: ticketId, tenantId },
      });

      if (!ticket) {
        throw new NotFoundException('Chamado não encontrado.');
      }

      if (currentUser.role === UserRole.EMPLOYEE && ticket.userId !== currentUser.id) {
        throw new ForbiddenException('Você não tem permissão para reabrir este chamado.');
      }

      if (ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CANCELLED) {
        throw new BadRequestException('Apenas chamados resolvidos ou cancelados podem ser reabertos.');
      }

      // Regra do Anexo A:
      // "Chamados resolvidos há até 7 dias podem ser reabertos."
      const closedDate = ticket.closedAt || ticket.updatedAt;
      const diffMs = new Date().getTime() - new Date(closedDate).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays > 7) {
        throw new BadRequestException(
          'Chamados resolvidos há mais de 7 dias não podem ser reabertos. Por favor, solicite a abertura de um novo chamado.',
        );
      }

      ticket.status = TicketStatus.IN_PROGRESS;
      ticket.closedAt = null;
      if (reason) {
        ticket.description = `${ticket.description}\n\n[Reaberto em ${new Date().toLocaleDateString('pt-BR')}]: ${reason}`;
      }

      const saved = await this.ticketRepository.save(ticket);
      this.logger.log(`🔄 Ticket ${saved.code} reopened by ${currentUser.email}`);

      return saved;
    });
  }
}

