import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpArticle } from '../../../entities/help-article.entity';
import { SearchArticlesDto } from '../dto/search-articles.dto';
import { VectorRagService } from './vector-rag.service';

@Injectable()
export class SearchArticlesService {
  private readonly logger = new Logger(SearchArticlesService.name);

  constructor(
    @InjectRepository(HelpArticle)
    private readonly articleRepository: Repository<HelpArticle>,
    private readonly vectorRagService: VectorRagService,
  ) {}

  async execute(tenantId: string, dto: SearchArticlesDto): Promise<HelpArticle[]> {
    // 1. Busca Semântica Vetorial (RAG com Google Gemini Embeddings)
    let vectorArticles: HelpArticle[] = [];
    if (dto.query && dto.query.trim() && this.vectorRagService.isAvailable()) {
      try {
        const scored = await this.vectorRagService.searchSimilarArticles(tenantId, dto.query.trim());
        vectorArticles = scored.map((s) => s.article);
      } catch (err: any) {
        this.logger.warn(`⚠️ Busca vetorial falhou, prosseguindo com busca léxica: ${err.message}`);
      }
    }

    // 2. Busca Léxica por Palavras-Chave (Keyword Search)
    const keywordArticles = await this.executeKeywordSearch(tenantId, dto);

    // 3. Combinação Híbrida (Hybrid Search: Vetorial + Léxica)
    const seen = new Set<string>();
    const merged: HelpArticle[] = [];

    // Prioriza os resultados com alta relevância semântica da busca vetorial
    for (const article of [...vectorArticles, ...keywordArticles]) {
      if (!seen.has(article.id)) {
        seen.add(article.id);
        merged.push(article);
      }
    }

    this.logger.log(
      `🔍 Busca híbrida para "${dto.query || ''}": ${merged.length} artigos retornados (${vectorArticles.length} vetoriais, ${keywordArticles.length} léxicos)`,
    );

    return merged;
  }

  private async executeKeywordSearch(tenantId: string, dto: SearchArticlesDto): Promise<HelpArticle[]> {
    const qb = this.articleRepository
      .createQueryBuilder('article')
      .where('article.tenantId = :tenantId', { tenantId })
      .andWhere('article.isActive = :isActive', { isActive: true });

    if (dto.category) {
      qb.andWhere('article.category = :category', { category: dto.category });
    }

    if (dto.query && dto.query.trim()) {
      const stopwords = new Set([
        'qual', 'que', 'como', 'onde', 'quando', 'por', 'porque', 'para',
        'com', 'sem', 'de', 'do', 'da', 'dos', 'das', 'um', 'uma', 'uns', 'umas',
        'o', 'a', 'os', 'as', 'e', 'é', 'em', 'no', 'na', 'nos', 'nas',
        'meu', 'minha', 'meus', 'minhas', 'seu', 'sua', 'seus', 'suas', 'está', 'estou'
      ]);

      const rawWords = dto.query.toLowerCase().replace(/[^\w\sáéíóúâêîôûãõç]/gi, ' ').trim().split(/\s+/);
      const significantWords = rawWords.filter((w) => w.length > 2 && !stopwords.has(w));
      const searchWords = significantWords.length > 0 ? significantWords : rawWords.filter((w) => w.length > 1);

      if (searchWords.length > 0) {
        const conditions: string[] = [];
        const parameters: Record<string, string> = {};

        searchWords.forEach((word, idx) => {
          conditions.push(
            `(LOWER(article.title) LIKE :w${idx} OR LOWER(article.content) LIKE :w${idx} OR LOWER(article.tags) LIKE :w${idx} OR LOWER(article.summary) LIKE :w${idx})`
          );
          parameters[`w${idx}`] = `%${word}%`;
        });

        qb.andWhere(`(${conditions.join(' OR ')})`, parameters);
      }
    }

    return await qb.getMany();
  }
}

