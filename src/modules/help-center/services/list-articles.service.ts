import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpArticle } from '../../../entities/help-article.entity';

@Injectable()
export class ListArticlesService {
  private readonly logger = new Logger(ListArticlesService.name);

  constructor(
    @InjectRepository(HelpArticle)
    private readonly articleRepository: Repository<HelpArticle>,
  ) {}

  async execute(tenantId: string) {
    const articles = await this.articleRepository.find({
      where: { tenantId, isActive: true },
      order: { title: 'ASC' },
    });

    this.logger.log(`📚 Found ${articles.length} help articles for tenant ${tenantId}`);

    return articles;
  }
}

