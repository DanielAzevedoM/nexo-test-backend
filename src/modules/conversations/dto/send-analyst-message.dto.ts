import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendAnalystMessageDto {
  @ApiProperty({
    example: 'Olá Ana, sou o Roberto do suporte N2. Estou verificando seu chamado agora.',
  })
  @IsNotEmpty({ message: 'A mensagem não pode estar vazia' })
  @IsString({ message: 'A mensagem deve ser um texto' })
  content: string;
}

