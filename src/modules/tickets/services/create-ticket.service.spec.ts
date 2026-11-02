import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateTicketService } from './create-ticket.service';
import { TicketType } from '../../../enums/ticket-type.enum';
import { TicketCategory } from '../../../enums/ticket-category.enum';
import { TicketPriority } from '../../../enums/ticket-priority.enum';
import { AffectedScope } from '../../../enums/affected-scope.enum';
import { ConflictException } from '@nestjs/common';

describe('CreateTicketService', () => {
  let service: CreateTicketService;
  let mockTicketRepo: any;
  let mockLegacyService: any;

  beforeEach(() => {
    mockTicketRepo = {
      findOne: vi.fn(),
      create: vi.fn((data) => ({ id: 'mock-uuid', ...data })),
      save: vi.fn(async (data) => data),
    };

    mockLegacyService = {
      executeWithLegacyResilience: vi.fn(async (_name, fn) => await fn()),
    };

    service = new CreateTicketService(mockTicketRepo, mockLegacyService);
  });

  it('should create a ticket with correct priority and SLA calculation', async () => {
    mockTicketRepo.findOne.mockResolvedValue(null);

    const dto = {
      title: 'VPN não conecta',
      description: 'Erro 809',
      type: TicketType.INCIDENT,
      category: TicketCategory.NETWORK_VPN,
      priority: TicketPriority.HIGH,
      affectedScope: AffectedScope.ONLY_ME,
    };

    const result = await service.execute('nexo-corp', 'user-123', dto);

    expect(result).toBeDefined();
    expect(result.code).toMatch(/^INC-\d+/);
    expect(result.priority).toBe(TicketPriority.HIGH);
    expect(result.slaDeadline).toBeDefined();
    expect(mockTicketRepo.save).toHaveBeenCalled();
  });

  it('should throw ConflictException if duplicate open ticket exists (Annex A)', async () => {
    mockTicketRepo.findOne.mockResolvedValue({
      id: 'existing-id',
      code: 'INC-20311',
      title: 'Notebook lento',
    });

    const dto = {
      title: 'Notebook lento',
      description: 'Ainda muito lento',
      type: TicketType.INCIDENT,
      category: TicketCategory.HARDWARE,
      priority: TicketPriority.MEDIUM,
    };

    await expect(service.execute('nexo-corp', 'user-123', dto)).rejects.toThrow(
      ConflictException,
    );
  });
});

