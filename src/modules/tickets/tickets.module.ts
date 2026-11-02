import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { TicketsController } from './controllers/tickets.controller';
import { CreateTicketService } from './services/create-ticket.service';
import { ListTicketsService } from './services/list-tickets.service';
import { GetTicketService } from './services/get-ticket.service';
import { UpdateTicketService } from './services/update-ticket.service';
import { ReopenTicketService } from './services/reopen-ticket.service';
import { LegacyTicketSystemService } from './services/legacy-ticket-system.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket])],
  controllers: [TicketsController],
  providers: [
    LegacyTicketSystemService,
    CreateTicketService,
    ListTicketsService,
    GetTicketService,
    UpdateTicketService,
    ReopenTicketService,
  ],
  exports: [
    LegacyTicketSystemService,
    CreateTicketService,
    ListTicketsService,
    GetTicketService,
    UpdateTicketService,
    ReopenTicketService,
  ],
})
export class TicketsModule {}

