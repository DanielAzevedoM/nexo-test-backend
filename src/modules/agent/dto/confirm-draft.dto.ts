import { IsNotEmpty, IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DraftAction {
  CONFIRM = 'CONFIRM',
  EDIT = 'EDIT',
  CANCEL = 'CANCEL',
}

export class ConfirmDraftDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID('4', { message: 'ID de conversa inválido' })
  @IsNotEmpty({ message: 'O ID da conversa é obrigatório' })
  conversationId: string;

  @ApiProperty({ enum: DraftAction, example: DraftAction.CONFIRM })
  @IsEnum(DraftAction, { message: 'Ação inválida (CONFIRM, EDIT, CANCEL)' })
  action: DraftAction;

  @ApiPropertyOptional({ description: 'Dados editados do rascunho (se action = EDIT)' })
  @IsOptional()
  editedDraft?: {
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    affectedScope?: string;
  };
}

