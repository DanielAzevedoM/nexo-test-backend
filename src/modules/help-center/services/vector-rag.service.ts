import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenAI } from '@google/genai';
import { HelpArticle } from '../../../entities/help-article.entity';

export interface ScoredArticle {
  article: HelpArticle;
  similarity: number;
}

@Injectable()
export class VectorRagService {
  private readonly logger = new Logger(VectorRagService.name);
  private ai: GoogleGenAI | null = null;
  private isGeneratingEmbeddings = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(HelpArticle)
    private readonly articleRepo: Repository<HelpArticle>,
  ) {
    const apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      process.env.GEMINI_API_KEY ||
      null;

    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      try {
        this.ai = new GoogleGenAI({ apiKey });
        this.logger.log('🧠 Vector RAG Service inicializado com Google Gemini Embeddings.');
      } catch (err: any) {
        this.logger.warn(`⚠️ Não foi possível inicializar Gemini Embeddings: ${err.message}`);
      }
    }
  }

  isAvailable(): boolean {
    return this.ai !== null;
  }

  /**
   * Calcula a Similaridade de Cosseno entre dois vetores densos
   */
  calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Gera embedding vetorial para um texto usando o modelo gemini-embedding-001
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.ai || !text || !text.trim()) return null;

    try {
      const res = await this.ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text.slice(0, 2048), // Limita tamanho seguro
      });

      if (res && res.embeddings && res.embeddings[0]?.values) {
        return res.embeddings[0].values;
      }
      return null;
    } catch (err: any) {
      this.logger.warn(`⚠️ Erro ao gerar embedding vetorial: ${err.message}`);
      return null;
    }
  }

  /**
   * Assegura que todos os artigos ativos no banco tenham seus vetores de embedding calculados
   */
  async ensureArticleEmbeddings(tenantId: string): Promise<void> {
    if (!this.ai || this.isGeneratingEmbeddings) return;

    try {
      this.isGeneratingEmbeddings = true;
      const articlesWithoutEmbedding = await this.articleRepo.find({
        where: { tenantId, isActive: true },
      });

      for (const article of articlesWithoutEmbedding) {
        if (!article.embeddingJson) {
          const textToEmbed = `${article.title}. Categoria: ${article.category}. Resumo: ${article.summary}. Conteúdo: ${article.content}`;
          const vector = await this.generateEmbedding(textToEmbed);
          if (vector) {
            article.embeddingJson = JSON.stringify(vector);
            await this.articleRepo.save(article);
            this.logger.log(`📌 Vetor RAG gerado para artigo: "${article.title}" (${vector.length}d)`);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`⚠️ Falha ao garantir embeddings dos artigos: ${err.message}`);
    } finally {
      this.isGeneratingEmbeddings = false;
    }
  }

  /**
   * Realiza busca vetorial semântica (RAG) retornando os artigos mais similares
   */
  async searchSimilarArticles(
    tenantId: string,
    query: string,
    minSimilarity = 0.45,
    topK = 5,
  ): Promise<ScoredArticle[]> {
    if (!this.ai || !query || !query.trim()) return [];

    try {
      // 1. Gera embedding da query do usuário
      const queryVector = await this.generateEmbedding(query);
      if (!queryVector) return [];

      // 2. Busca todos os artigos ativos
      const articles = await this.articleRepo.find({
        where: { tenantId, isActive: true },
      });

      const scored: ScoredArticle[] = [];

      for (const article of articles) {
        let articleVector: number[] | null = null;
        if (article.embeddingJson) {
          try {
            articleVector = JSON.parse(article.embeddingJson);
          } catch {
            articleVector = null;
          }
        }

        // Se o artigo ainda não tinha embedding salvo, calcula agora
        if (!articleVector) {
          const textToEmbed = `${article.title}. ${article.summary} ${article.content}`;
          articleVector = await this.generateEmbedding(textToEmbed);
          if (articleVector) {
            article.embeddingJson = JSON.stringify(articleVector);
            await this.articleRepo.save(article);
          }
        }

        if (articleVector) {
          const sim = this.calculateCosineSimilarity(queryVector, articleVector);
          if (sim >= minSimilarity) {
            scored.push({ article, similarity: sim });
          }
        }
      }

      // Ordena por maior similaridade de cosseno
      scored.sort((a, b) => b.similarity - a.similarity);

      this.logger.log(
        `🧠 Busca vetorial RAG para "${query}": ${scored.length} artigos encontrados (top score: ${scored[0]?.similarity.toFixed(3) || 0})`,
      );

      return scored.slice(0, topK);
    } catch (err: any) {
      this.logger.warn(`⚠️ Erro na busca vetorial RAG: ${err.message}`);
      return [];
    }
  }
}
