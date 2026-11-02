import {
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategory } from '../../../enums/ticket-category.enum';
import { TicketPriority } from '../../../enums/ticket-priority.enum';
import { TicketStatus } from '../../../enums/ticket-status.enum';
import { AffectedScope } from '../../../enums/affected-scope.enum';

export class UpdateTicketDto {
  @ApiPropertyOptional({ example: 'Notebook lento após atualização do Windows' })
  @IsOptional()
  @IsString({ message: 'O título deve ser um texto' })
  @MaxLength(255, { message: 'O título deve ter no máximo 255 caracteres' })
  title?: string;

  @ApiPropertyOptional({ example: 'Nova informação adicionada pelo usuário: o problema piora ao abrir o Teams.' })
  @IsOptional()
  @IsString({ message: 'A descrição deve ser um texto' })
  description?: string;

  @ApiPropertyOptional({ enum: TicketCategory })
  @IsOptional()
  @IsEnum(TicketCategory, { message: 'Categoria inválida' })
  category?: TicketCategory;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority, { message: 'Prioridade inválida' })
  priority?: TicketPriority;

  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus, { message: 'Status inválido' })
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: AffectedScope })
  @IsOptional()
  @IsEnum(AffectedScope, { message: 'Escopo de afetados inválido' })
  affectedScope?: AffectedScope;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  assignedAnalystId?: string;
}

