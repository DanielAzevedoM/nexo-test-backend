import { ApiResponseOptions } from '@nestjs/swagger';

export const ConversationListResponse: ApiResponseOptions = {
  status: 200,
  description: 'Lista de conversas retornada com sucesso.',
  schema: {
    example: {
      data: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'WAITING_HUMAN',
          user: { name: 'Ana Souza', email: 'ana.souza@nexo.com.br' },
          transferReason: 'Solicitado pelo usuário · INC-20311',
          lastMessageAt: '2026-10-20T10:05:00.000Z',
        },
      ],
      counts: {
        all: 12,
        needsHuman: 3,
        withAgent: 9,
        myChats: 1,
      },
    },
  },
};

