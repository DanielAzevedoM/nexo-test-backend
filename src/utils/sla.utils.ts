import { TicketPriority } from '../enums/ticket-priority.enum';

/**
 * Utilitários para cálculo de SLA de acordo com as regras do Service Desk Nexo (Anexo A):
 * - Crítica: 1 hora corrida (plantão 24h)
 * - Alta: 4 horas úteis
 * - Média: 3 dias úteis
 * - Baixa: 5 dias úteis
 * 
 * Horário comercial: Segunda a Sexta, das 08:00 às 18:00.
 */
export function calculateSlaDeadline(
  priority: TicketPriority,
  startDate: Date = new Date(),
): Date {
  const result = new Date(startDate.getTime());

  switch (priority) {
    case TicketPriority.CRITICAL: {
      // 1 hora corrida
      result.setHours(result.getHours() + 1);
      return result;
    }

    case TicketPriority.HIGH: {
      // 4 horas úteis
      return addBusinessHours(result, 4);
    }

    case TicketPriority.MEDIUM: {
      // 3 dias úteis (3 * 10h = 30 horas úteis)
      return addBusinessDays(result, 3);
    }

    case TicketPriority.LOW: {
      // 5 dias úteis
      return addBusinessDays(result, 5);
    }

    default:
      return addBusinessDays(result, 3);
  }
}

/**
 * Adiciona horas úteis (08:00 - 18:00, seg-sex)
 */
export function addBusinessHours(startDate: Date, hoursToAdd: number): Date {
  const current = new Date(startDate.getTime());
  let remainingHours = hoursToAdd;

  while (remainingHours > 0) {
    // Se for fim de semana (0 = domingo, 6 = sábado), avança para segunda-feira 08:00
    const day = current.getDay();
    if (day === 0) {
      current.setDate(current.getDate() + 1);
      current.setHours(8, 0, 0, 0);
      continue;
    }
    if (day === 6) {
      current.setDate(current.getDate() + 2);
      current.setHours(8, 0, 0, 0);
      continue;
    }

    const currentHour = current.getHours();

    // Se antes das 8h, ajusta para 8h
    if (currentHour < 8) {
      current.setHours(8, 0, 0, 0);
      continue;
    }

    // Se após ou igual às 18h, avança para próximo dia útil às 8h
    if (currentHour >= 18) {
      current.setDate(current.getDate() + 1);
      current.setHours(8, 0, 0, 0);
      continue;
    }

    // Horas restantes no dia de hoje até as 18:00
    const hoursLeftToday = 18 - currentHour - (current.getMinutes() > 0 ? 1 : 0);

    if (remainingHours <= hoursLeftToday) {
      current.setHours(current.getHours() + remainingHours);
      remainingHours = 0;
    } else {
      remainingHours -= Math.max(1, hoursLeftToday);
      current.setDate(current.getDate() + 1);
      current.setHours(8, 0, 0, 0);
    }
  }

  return current;
}

/**
 * Adiciona dias úteis (seg-sex)
 */
export function addBusinessDays(startDate: Date, daysToAdd: number): Date {
  const current = new Date(startDate.getTime());
  let added = 0;

  while (added < daysToAdd) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }

  return current;
}

/**
 * Verifica se um chamado está com prazo vencido
 */
export function isTicketOverdue(slaDeadline?: Date | string | null): boolean {
  if (!slaDeadline) return false;
  const deadline = typeof slaDeadline === 'string' ? new Date(slaDeadline) : slaDeadline;
  return new Date().getTime() > deadline.getTime();
}

/**
 * Formata descrição amigável de prazo de acordo com a prioridade
 */
export function formatDueEstimate(priority: TicketPriority): string {
  switch (priority) {
    case TicketPriority.CRITICAL:
      return 'em até 1 h';
    case TicketPriority.HIGH:
      return 'em até 4 h úteis';
    case TicketPriority.MEDIUM:
      return 'em até 3 dias úteis';
    case TicketPriority.LOW:
      return 'em até 5 dias úteis';
    default:
      return 'em até 3 dias úteis';
  }
}

/**
 * Retorna texto relativo amigável de tempo restante ou vencido
 */
export function formatSlaRemaining(slaDeadline?: Date | string | null): {
  isOverdue: boolean;
  text: string;
} {
  if (!slaDeadline) {
    return { isOverdue: false, text: 'sem prazo definido' };
  }

  const deadline = typeof slaDeadline === 'string' ? new Date(slaDeadline) : slaDeadline;
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs < 0) {
    const hoursOverdue = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
    const daysOverdue = Math.floor(hoursOverdue / 24);

    if (daysOverdue > 0) {
      return { isOverdue: true, text: `prazo vencido há ${daysOverdue} dia${daysOverdue > 1 ? 's' : ''}` };
    }
    return { isOverdue: true, text: `prazo vencido há ${Math.max(1, hoursOverdue)}h` };
  }

  const hoursRemaining = Math.floor(diffMs / (1000 * 60 * 60));
  const daysRemaining = Math.floor(hoursRemaining / 24);

  if (daysRemaining > 0) {
    return { isOverdue: false, text: `resposta em até ${daysRemaining} dia${daysRemaining > 1 ? 's' : ''}` };
  }

  const minutesRemaining = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hoursRemaining > 0) {
    return { isOverdue: false, text: `resposta em até ${hoursRemaining}h ${minutesRemaining}m` };
  }

  return { isOverdue: false, text: `resposta em até ${Math.max(1, minutesRemaining)} min` };
}

