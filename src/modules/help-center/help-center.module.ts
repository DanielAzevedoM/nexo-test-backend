import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HelpArticle } from '../../entities/help-article.entity';
import { HelpCenterController } from './controllers/help-center.controller';
import { ListArticlesService } from './services/list-articles.service';
import { SearchArticlesService } from './services/search-articles.service';
import { GetArticleService } from './services/get-article.service';
import { VectorRagService } from './services/vector-rag.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([HelpArticle])],
  controllers: [HelpCenterController],
  providers: [
    ListArticlesService,
    SearchArticlesService,
    GetArticleService,
    VectorRagService,
  ],
  exports: [
    ListArticlesService,
    SearchArticlesService,
    GetArticleService,
    VectorRagService,
  ],
})
export class HelpCenterModule {}

