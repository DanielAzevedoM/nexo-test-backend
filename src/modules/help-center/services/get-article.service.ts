import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpArticle } from '../../../entities/help-article.entity';

@Injectable()
export class GetArticleService {
  private readonly logger = new Logger(GetArticleService.name);

  constructor(
    @InjectRepository(HelpArticle)
    private readonly articleRepository: Repository<HelpArticle>,
  ) {}

  async execute(tenantId: string, id: string) {
    const article = await this.articleRepository.findOne({
      where: { id, tenantId, isActive: true },
    });

    if (!article) {
      throw new NotFoundException('Artigo não encontrado na central de ajuda.');
    }

    this.logger.log(`📄 Retrieved article ${article.id} ("${article.title}")`);

    return article;
  }
}

