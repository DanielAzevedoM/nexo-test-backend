import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterConversationsDto {
  @ApiPropertyOptional({
    example: 'needs_human',
    description: 'Filtro de aba: "all" (Todas), "needs_human" (Para você), "with_agent" (Com o agent), "my_chats" (Minhas)',
  })
  @IsOptional()
  @IsString()
  tab?: 'all' | 'needs_human' | 'with_agent' | 'my_chats';

  @ApiPropertyOptional({ description: 'Busca por nome de funcionário ou chamado' })
  @IsOptional()
  @IsString()
  search?: string;
}

