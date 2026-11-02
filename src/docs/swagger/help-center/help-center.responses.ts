import { ApiResponseOptions } from '@nestjs/swagger';

export const HelpCenterListResponse: ApiResponseOptions = {
  status: 200,
  description: 'Lista de artigos da central de ajuda.',
  schema: {
    example: {
      data: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'VPN com erro 809',
          category: 'NETWORK_VPN',
          summary: 'Como resolver o erro 809 na VPN Nexo.',
          content: 'VPN com erro 809: reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.',
          tags: 'vpn, erro 809, rede, windows',
        },
      ],
    },
  },
};

