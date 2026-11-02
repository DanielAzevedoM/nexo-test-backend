import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ListArticlesService } from '../services/list-articles.service';
import { SearchArticlesService } from '../services/search-articles.service';
import { GetArticleService } from '../services/get-article.service';
import { SearchArticlesDto } from '../dto/search-articles.dto';
import { User } from '../../../entities/user.entity';
import { HelpCenterListResponse } from '../../../docs/swagger/help-center/help-center.responses';

@ApiTags('Central de Ajuda')
@Controller('help-center')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class HelpCenterController {
  constructor(
    private readonly listArticlesService: ListArticlesService,
    private readonly searchArticlesService: SearchArticlesService,
    private readonly getArticleService: GetArticleService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos os artigos ativos' })
  @ApiResponse(HelpCenterListResponse)
  findAll(@Request() req: { user: User }) {
    return this.listArticlesService.execute(req.user.tenantId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar artigos por palavra-chave ou categoria' })
  search(@Request() req: { user: User }, @Query() query: SearchArticlesDto) {
    return this.searchArticlesService.execute(req.user.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar artigo por ID' })
  findOne(@Request() req: { user: User }, @Param('id') id: string) {
    return this.getArticleService.execute(req.user.tenantId, id);
  }
}

