import { ApiResponseOptions } from '@nestjs/swagger';

export const TicketCreateResponse: ApiResponseOptions = {
  status: 201,
  description: 'Chamado criado com sucesso.',
  schema: {
    example: {
      data: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        code: 'INC-20517',
        title: 'VPN não conecta no notebook — erro 809',
        category: 'NETWORK_VPN',
        priority: 'HIGH',
        status: 'OPEN',
        createdAt: '2026-10-20T10:00:00.000Z',
      },
    },
  },
};

export const TicketListResponse: ApiResponseOptions = {
  status: 200,
  description: 'Lista de chamados retornada com sucesso.',
  schema: {
    example: {
      data: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          code: 'INC-20311',
          title: 'Notebook lento após atualização do Windows',
          category: 'HARDWARE',
          priority: 'MEDIUM',
          status: 'WAITING_ANALYST',
        },
      ],
      total: 1,
    },
  },
};

