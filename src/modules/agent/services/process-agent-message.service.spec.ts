import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessAgentMessageService } from './process-agent-message.service';
import { ConversationStatus } from '../../../enums/conversation-status.enum';
import { UserRole } from '../../../enums/user-role.enum';
import { BadRequestException } from '@nestjs/common';

describe('ProcessAgentMessageService', () => {
  let service: ProcessAgentMessageService;
  let mockConvRepo: any;
  let mockMsgRepo: any;
  let mockDecisionRepo: any;
  let mockTicketRepo: any;
  let mockSearchArticlesService: any;
  let mockGeminiAgentService: any;

  beforeEach(() => {
    mockConvRepo = {
      findOne: vi.fn(),
      save: vi.fn(async (c) => c),
    };

    mockMsgRepo = {
      create: vi.fn((data) => ({ id: 'msg-uuid', ...data })),
      save: vi.fn(async (m) => m),
      findOne: vi.fn().mockResolvedValue(null),
    };

    mockDecisionRepo = {
      create: vi.fn((data) => ({ id: 'dec-uuid', ...data })),
      save: vi.fn(async (d) => d),
    };

    mockTicketRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    mockSearchArticlesService = {
      execute: vi.fn().mockResolvedValue([]),
    };

    mockGeminiAgentService = {
      isAvailable: vi.fn().mockReturnValue(false),
      process: vi.fn(),
    };

    const mockConfirmDraftService: any = {
      execute: vi.fn(),
    };

    service = new ProcessAgentMessageService(
      mockConvRepo,
      mockMsgRepo,
      mockDecisionRepo,
      mockTicketRepo,
      mockSearchArticlesService,
      mockGeminiAgentService,
      mockConfirmDraftService,
    );
  });

  const currentUser: any = {
    id: 'user-1',
    name: 'Ana Souza',
    email: 'ana.souza@nexo.com.br',
    role: UserRole.EMPLOYEE,
  };

  it('should enforce 30 messages session limit (PRD Item 2)', async () => {
    mockConvRepo.findOne.mockResolvedValue({
      id: 'conv-1',
      tenantId: 'nexo-corp',
      messageCount: 30,
      status: ConversationStatus.WITH_AGENT,
    });

    await expect(
      service.execute('nexo-corp', currentUser, {
        conversationId: 'conv-1',
        message: 'Olá',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should redirect non-IT topics (Annex A: Scope)', async () => {
    mockConvRepo.findOne.mockResolvedValue({
      id: 'conv-1',
      tenantId: 'nexo-corp',
      messageCount: 5,
      status: ConversationStatus.WITH_AGENT,
    });

    const res = await service.execute('nexo-corp', currentUser, {
      conversationId: 'conv-1',
      message: 'Qual o valor do meu salário e reembolso de km este mês?',
    });

    expect(res.agentMessage).toBeDefined();
    expect(res.agentMessage?.content).toContain('exclusivamente solicitações de Tecnologia da Informação');
    expect(res.agentMessage?.actions).toContain('verificou o escopo');
  });

  it('should transfer to human analyst when requested (History 5 & Annex A)', async () => {
    const conv = {
      id: 'conv-1',
      tenantId: 'nexo-corp',
      messageCount: 2,
      status: ConversationStatus.WITH_AGENT,
      agentPaused: false,
    };
    mockConvRepo.findOne.mockResolvedValue(conv);

    const res = await service.execute('nexo-corp', currentUser, {
      conversationId: 'conv-1',
      message: 'Quero falar com um analista por favor',
    });

    expect(res.conversation.status).toBe(ConversationStatus.WAITING_HUMAN);
    expect(res.conversation.agentPaused).toBe(true);
    expect(res.agentMessage?.actions).toContain('transferiu para analista');
  });

  it('should pause agent when conversation is in attendance with human (PRD Item 5)', async () => {
    const conv = {
      id: 'conv-1',
      tenantId: 'nexo-corp',
      messageCount: 5,
      status: ConversationStatus.IN_ATTENDANCE,
      agentPaused: true,
    };
    mockConvRepo.findOne.mockResolvedValue(conv);

    const res = await service.execute('nexo-corp', currentUser, {
      conversationId: 'conv-1',
      message: 'Certo, analista, estou aguardando',
    });

    expect(res.isPaused).toBe(true);
    expect(res.agentMessage).toBeNull();
  });

  it('should process message with Google Gemini when service is available', async () => {
    mockGeminiAgentService.isAvailable.mockReturnValue(true);
    mockGeminiAgentService.process.mockResolvedValue({
      reply: 'Olá! Sou o Nexo Assist via Gemini. Como posso ajudar com sua dúvida de TI?',
      actions: ['processou a mensagem com IA'],
      intent: 'GENERAL_ASSISTANCE',
      confidence: 96,
      reasoning: 'Iniciado atendimento via LLM Gemini.',
      rulesApplied: ['Regras do Service Desk Nexo (Anexo A)'],
      toolsCalled: [{ name: 'gemini_inference', description: 'Inferência com Gemini', latencyMs: 250 }],
      metadata: {},
      escalateToAnalyst: false,
    });

    mockConvRepo.findOne.mockResolvedValue({
      id: 'conv-1',
      tenantId: 'nexo-corp',
      messageCount: 1,
      status: ConversationStatus.WITH_AGENT,
    });

    const res = await service.execute('nexo-corp', currentUser, {
      conversationId: 'conv-1',
      message: 'Olá, preciso de ajuda',
    });

    expect(mockGeminiAgentService.process).toHaveBeenCalled();
    expect(res.agentMessage).toBeDefined();
    expect(res.agentMessage?.content).toContain('Olá! Sou o Nexo Assist via Gemini.');
    expect(res.agentMessage?.actions).toContain('processou a mensagem com IA');
  });

  it('should intercept draft confirmation directly from chat message and create ticket', async () => {
    mockConvRepo.findOne.mockResolvedValue({
      id: 'conv-1',
      tenantId: 'nexo-corp',
      messageCount: 2,
      status: ConversationStatus.WITH_AGENT,
    });

    mockMsgRepo.findOne.mockResolvedValue({
      id: 'last-msg-id',
      sender: 'AGENT',
      metadata: {
        draftTicket: {
          code: 'D-381',
          title: 'VPN com erro',
          description: 'Erro 809',
        },
      },
    });

    const mockConfirmResult = {
      status: 'CONFIRMED',
      message: {
        id: 'confirm-msg-id',
        content: 'Pronto: abri o chamado com prioridade alta.',
        actions: ['consultou seus chamados', 'criou um chamado'],
      },
    };

    const confirmDraftService = (service as any).confirmDraftService;
    confirmDraftService.execute.mockResolvedValue(mockConfirmResult);

    const res = await service.execute('nexo-corp', currentUser, {
      conversationId: 'conv-1',
      message: 'Confirmar abertura',
    });

    expect(confirmDraftService.execute).toHaveBeenCalledWith(
      'nexo-corp',
      currentUser,
      expect.objectContaining({ conversationId: 'conv-1', action: 'CONFIRM' }),
    );
    expect(res.agentMessage?.content).toContain('Pronto: abri o chamado');
  });
});

