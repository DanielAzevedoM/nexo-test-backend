import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiPropertyOptional({ example: 'INC-20311', description: 'Código ou ID de chamado relacionado (opcional)' })
  @IsOptional()
  @IsString()
  relatedTicketId?: string;

  @ApiPropertyOptional({ example: false, description: 'Se verdadeiro, força a criação de uma nova conversa' })
  @IsOptional()
  @IsBoolean()
  forceNew?: boolean;
}
