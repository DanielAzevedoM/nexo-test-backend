import { Injectable, Logger, ServiceUnavailableException, HttpException } from '@nestjs/common';

/**
 * Serviço de chamados simulado (Legado).
 * O PRD especifica:
 * "Serviço de chamados simulado: com dados de exemplo criados por você (veja o Anexo B),
 * separado do agent, permitindo consultar, criar, atualizar e transferir chamados.
 * O sistema de chamados é legado e, de vez em quando, fica indisponível por alguns segundos."
 */
@Injectable()
export class LegacyTicketSystemService {
  private readonly logger = new Logger(LegacyTicketSystemService.name);

  // Simula chance de indisponibilidade transitória do sistema legado (ex: 2%)
  private failureRate = 0.02;

  /**
   * Executa uma operação contra o sistema legado com resiliência e simulação de latência
   */
  async executeWithLegacyResilience<T>(
    operationName: string,
    action: () => Promise<T>,
    maxRetries = 2,
  ): Promise<T> {
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        // Simulação de latência de rede/sistema legado (entre 30ms e 120ms)
        const delayMs = Math.floor(Math.random() * 90) + 30;
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        // Simula falha transitória do sistema legado (se acionado)
        if (Math.random() < this.failureRate && attempt === 1) {
          this.logger.warn(
            `⚠️ Legacy ticket system temporary failure during ${operationName}. Retrying...`,
          );
          // Espera 300ms antes da nova tentativa
          await new Promise((resolve) => setTimeout(resolve, 300));
          throw new Error('Sistema de chamados legado temporariamente indisponível.');
        }

        const result = await action();
        return result;
      } catch (err: any) {
        // Exceções de regras de negócio (400, 403, 404, 409) devem ser propagadas imediatamente
        if (err instanceof HttpException) {
          throw err;
        }

        if (attempt > maxRetries) {
          this.logger.error(
            `❌ Legacy ticket system failed after ${maxRetries} retries: ${err.message}`,
          );
          throw new ServiceUnavailableException(
            'O sistema legado de chamados está temporariamente indisponível. Tente novamente em instantes.',
          );
        }
      }
    }

    throw new ServiceUnavailableException('Falha de comunicação com o sistema legado de chamados.');
  }

  setFailureRate(rate: number) {
    this.failureRate = rate;
  }
}

