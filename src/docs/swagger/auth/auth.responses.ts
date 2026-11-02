import { ApiResponseOptions } from '@nestjs/swagger';

export const AuthLoginResponse: ApiResponseOptions = {
  status: 200,
  description: 'Login realizado com sucesso.',
  schema: {
    example: {
      data: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Ana Souza',
          email: 'ana.souza@nexo.com.br',
          department: 'Financeiro',
          role: 'EMPLOYEE',
          avatarUrl: null,
        },
      },
    },
  },
};

export const AuthGetMeResponse: ApiResponseOptions = {
  status: 200,
  description: 'Dados do usuário autenticado.',
  schema: {
    example: {
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Ana Souza',
        email: 'ana.souza@nexo.com.br',
        department: 'Financeiro',
        role: 'EMPLOYEE',
      },
    },
  },
};

