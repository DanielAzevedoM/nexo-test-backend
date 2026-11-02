import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReopenTicketService } from './reopen-ticket.service';
import { TicketStatus } from '../../../enums/ticket-status.enum';
import { UserRole } from '../../../enums/user-role.enum';
import { BadRequestException } from '@nestjs/common';

describe('ReopenTicketService', () => {
  let service: ReopenTicketService;
  let mockTicketRepo: any;
  let mockLegacyService: any;

  beforeEach(() => {
    mockTicketRepo = {
      findOne: vi.fn(),
      save: vi.fn(async (data) => data),
    };

    mockLegacyService = {
      executeWithLegacyResilience: vi.fn(async (_name, fn) => await fn()),
    };

    service = new ReopenTicketService(mockTicketRepo, mockLegacyService);
  });

  it('should reopen ticket resolved within 7 days (Annex A)', async () => {
    const closed4DaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const mockTicket = {
      id: 'ticket-1',
      code: 'INC-20150',
      userId: 'user-1',
      status: TicketStatus.RESOLVED,
      closedAt: closed4DaysAgo,
      description: 'Problema no SAP',
    };
    mockTicketRepo.findOne.mockResolvedValue(mockTicket);

    const currentUser: any = { id: 'user-1', role: UserRole.EMPLOYEE, email: 'ana@nexo.com.br' };
    const res = await service.execute('nexo-corp', currentUser, 'ticket-1', 'Ainda sem acesso');

    expect(res.status).toBe(TicketStatus.IN_PROGRESS);
    expect(res.closedAt).toBeNull();
  });

  it('should reject reopening tickets resolved more than 7 days ago (Annex A)', async () => {
    const closed15DaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const mockTicket = {
      id: 'ticket-2',
      code: 'INC-19800',
      userId: 'user-1',
      status: TicketStatus.RESOLVED,
      closedAt: closed15DaysAgo,
      description: 'Teclado com defeito',
    };
    mockTicketRepo.findOne.mockResolvedValue(mockTicket);

    const currentUser: any = { id: 'user-1', role: UserRole.EMPLOYEE, email: 'ana@nexo.com.br' };
    await expect(
      service.execute('nexo-corp', currentUser, 'ticket-2', 'Reabrir por favor'),
    ).rejects.toThrow(BadRequestException);
  });
});

