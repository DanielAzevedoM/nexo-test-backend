import { describe, it, expect } from 'vitest';
import {
  calculateSlaDeadline,
  isTicketOverdue,
  formatDueEstimate,
  formatSlaRemaining,
} from './sla.utils';
import { TicketPriority } from '../enums/ticket-priority.enum';

describe('SLA Utils', () => {
  it('should calculate 1 hour for CRITICAL priority', () => {
    const start = new Date('2026-10-20T10:00:00Z');
    const deadline = calculateSlaDeadline(TicketPriority.CRITICAL, start);
    expect(deadline.getTime() - start.getTime()).toBe(60 * 60 * 1000);
  });

  it('should correctly format due estimates according to Annex A', () => {
    expect(formatDueEstimate(TicketPriority.CRITICAL)).toBe('em até 1 h');
    expect(formatDueEstimate(TicketPriority.HIGH)).toBe('em até 4 h úteis');
    expect(formatDueEstimate(TicketPriority.MEDIUM)).toBe('em até 3 dias úteis');
    expect(formatDueEstimate(TicketPriority.LOW)).toBe('em até 5 dias úteis');
  });

  it('should detect overdue ticket when deadline is in the past', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    expect(isTicketOverdue(past)).toBe(true);

    const future = new Date(Date.now() + 1000 * 60 * 60 * 24);
    expect(isTicketOverdue(future)).toBe(false);
  });

  it('should format overdue text properly', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 48); // 2 days ago
    const res = formatSlaRemaining(past);
    expect(res.isOverdue).toBe(true);
    expect(res.text).toContain('prazo vencido');
  });
});

