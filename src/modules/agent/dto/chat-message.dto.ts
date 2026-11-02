import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'ID da conversa' })
  @IsUUID('4', { message: 'ID de conversa inválido' })
  @IsNotEmpty({ message: 'O ID da conversa é obrigatório' })
  conversationId: string;

  @ApiProperty({ example: 'Meu notebook não conecta na VPN desde ontem. Aparece o erro 809.' })
  @IsNotEmpty({ message: 'A mensagem não pode estar vazia' })
  @IsString({ message: 'A mensagem deve ser um texto' })
  message: string;

  @ApiPropertyOptional({ example: 'INC-20311', description: 'Contexto opcional de chamado selecionado' })
  @IsOptional()
  @IsString()
  selectedTicketCode?: string;
}

