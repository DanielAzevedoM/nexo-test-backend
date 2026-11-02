import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentDecision } from '../../../entities/agent-decision.entity';

@Injectable()
export class GetDecisionDetailsService {
  private readonly logger = new Logger(GetDecisionDetailsService.name);

  constructor(
    @InjectRepository(AgentDecision)
    private readonly decisionRepo: Repository<AgentDecision>,
  ) {}

  async execute(decisionId: string) {
    const decision = await this.decisionRepo.findOne({
      where: [{ id: decisionId }, { messageId: decisionId }],
      relations: ['message'],
    });

    if (!decision) {
      throw new NotFoundException('Registro de decisão não encontrado.');
    }

    this.logger.log(`🔍 Retrieved decision details for ${decisionId}`);

    return decision;
  }
}

