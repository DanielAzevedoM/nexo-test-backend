import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'ana.souza@nexo.com.br',
    description: 'E-mail corporativo do funcionário ou analista',
  })
  @IsEmail({}, { message: 'O e-mail deve ser um endereço válido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;

  @ApiProperty({
    example: 'qualquer_senha_123',
    description: 'Senha da rede Nexo (aceita qualquer senha para os usuários de exemplo)',
  })
  @IsString({ message: 'A senha deve ser uma string' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @MinLength(1, { message: 'A senha não pode estar vazia' })
  password: string;
}

