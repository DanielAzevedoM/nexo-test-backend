import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { TicketStatus } from '../../../enums/ticket-status.enum';
import { TicketCategory } from '../../../enums/ticket-category.enum';
import { TicketPriority } from '../../../enums/ticket-priority.enum';
import { TicketType } from '../../../enums/ticket-type.enum';

export class FilterTicketsDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: TicketCategory })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ enum: TicketType })
  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;

  @ApiPropertyOptional({ description: 'Filtrar chamados de um usuário específico (apenas analistas)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Busca por termo no código ou título' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Apenas chamados com prazo vencido' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdueOnly?: boolean;
}

