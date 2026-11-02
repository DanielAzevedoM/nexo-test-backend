import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategory } from '../../../enums/ticket-category.enum';

export class SearchArticlesDto {
  @ApiPropertyOptional({ example: 'vpn erro 809', description: 'Termo de busca na central de ajuda' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ enum: TicketCategory, description: 'Categoria do artigo' })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;
}

