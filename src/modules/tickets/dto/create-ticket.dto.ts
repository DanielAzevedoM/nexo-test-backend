import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketType } from '../../../enums/ticket-type.enum';
import { TicketCategory } from '../../../enums/ticket-category.enum';
import { TicketPriority } from '../../../enums/ticket-priority.enum';
import { AffectedScope } from '../../../enums/affected-scope.enum';

export class CreateTicketDto {
  @ApiProperty({ example: 'VPN não conecta no notebook — erro 809' })
  @IsNotEmpty({ message: 'O título é obrigatório' })
  @IsString({ message: 'O título deve ser um texto' })
  @MaxLength(255, { message: 'O título deve ter no máximo 255 caracteres' })
  title: string;

  @ApiProperty({
    example: 'Desde 20/10 o notebook (Windows 11) não conecta na VPN e mostra o erro 809. Precisa dela para a reunião das 14h.',
  })
  @IsNotEmpty({ message: 'A descrição é obrigatória' })
  @IsString({ message: 'A descrição deve ser um texto' })
  description: string;

  @ApiProperty({ enum: TicketType, example: TicketType.INCIDENT })
  @IsNotEmpty({ message: 'O tipo do chamado é obrigatório' })
  @IsEnum(TicketType, { message: 'Tipo inválido (INCIDENT ou REQUEST)' })
  type: TicketType;

  @ApiProperty({ enum: TicketCategory, example: TicketCategory.NETWORK_VPN })
  @IsNotEmpty({ message: 'A categoria é obrigatória' })
  @IsEnum(TicketCategory, { message: 'Categoria inválida' })
  category: TicketCategory;

  @ApiProperty({ enum: TicketPriority, example: TicketPriority.HIGH })
  @IsNotEmpty({ message: 'A prioridade é obrigatória' })
  @IsEnum(TicketPriority, { message: 'Prioridade inválida' })
  priority: TicketPriority;

  @ApiPropertyOptional({ enum: AffectedScope, example: AffectedScope.ONLY_ME })
  @IsOptional()
  @IsEnum(AffectedScope, { message: 'Escopo de afetados inválido' })
  affectedScope?: AffectedScope;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  userId?: string; // If created on behalf of user
}

