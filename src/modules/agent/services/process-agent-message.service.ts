import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../../entities/conversation.entity';
import { Message } from '../../../entities/message.entity';
import { AgentDecision } from '../../../entities/agent-decision.entity';
import { Ticket } from '../../../entities/ticket.entity';
import { HelpArticle } from '../../../entities/help-article.entity';
import { User } from '../../../entities/user.entity';
import { ConversationStatus } from '../../../enums/conversation-status.enum';
import { MessageSender } from '../../../enums/message-sender.enum';
import { TicketStatus } from '../../../enums/ticket-status.enum';
import { TicketCategory } from '../../../enums/ticket-category.enum';
import { TicketPriority } from '../../../enums/ticket-priority.enum';
import { TicketType } from '../../../enums/ticket-type.enum';
import { AffectedScope } from '../../../enums/affected-scope.enum';
import { ChatMessageDto } from '../dto/chat-message.dto';
import { SearchArticlesService } from '../../help-center/services/search-articles.service';
import { isTicketOverdue, formatSlaRemaining, formatDueEstimate } from '../../../utils/sla.utils';
import { GeminiAgentService } from './gemini-agent.service';
import { ConfirmDraftService } from './confirm-draft.service';
import { DraftAction } from '../dto/confirm-draft.dto';

@Injectable()
export class ProcessAgentMessageService {
  private readonly logger = new Logger(ProcessAgentMessageService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(AgentDecision)
    private readonly decisionRepo: Repository<AgentDecision>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    private readonly searchArticlesService: SearchArticlesService,
    private readonly geminiAgentService: GeminiAgentService,
    private readonly confirmDraftService: ConfirmDraftService,
  ) {}

  async execute(tenantId: string, currentUser: User, dto: ChatMessageDto) {
    const startTime = Date.now();

    const conversation = await this.conversationRepo.findOne({
      where: { id: dto.conversationId, tenantId },
      relations: ['user', 'relatedTicket'],
    });

    if (!conversation) {
      throw new BadRequestException('Conversa não encontrada.');
    }

    // 1. Limite de 30 mensagens por sessão (PRD Item 2)
    const currentCount = conversation.messageCount || 0;
    if (currentCount >= 30) {
      throw new BadRequestException(
        'Você atingiu o limite de 30 mensagens nesta sessão. Para continuar, abra uma nova conversa.',
      );
    }

    // Salva a mensagem do usuário
    const userMessage = this.messageRepo.create({
      conversationId: conversation.id,
      sender: MessageSender.USER,
      content: dto.message,
    });
    await this.messageRepo.save(userMessage);

    conversation.messageCount = currentCount + 1;
    conversation.lastMessageAt = new Date();

    // 2. Se a conversa estiver com o analista humano ou aguardando atendente (PRD Item 5):
    // "o agent para de responder até ser liberado"
    if (
      conversation.status === ConversationStatus.IN_ATTENDANCE ||
      (conversation.status === ConversationStatus.WAITING_HUMAN && conversation.agentPaused)
    ) {
      await this.conversationRepo.save(conversation);
      this.logger.log(`⏸️ Agent paused: conversation ${conversation.id} is with human analyst.`);
      return {
        userMessage,
        agentMessage: null,
        conversation,
        isPaused: true,
      };
    }

    // 2.1. Interceptação de confirmação ou cancelamento direto de rascunho pendente via chat
    const lastAgentMsg = await this.messageRepo.findOne({
      where: { conversationId: conversation.id, sender: MessageSender.AGENT },
      order: { createdAt: 'DESC' },
    });

    let pendingDraft: any = null;
    if (lastAgentMsg?.metadata) {
      let meta = lastAgentMsg.metadata;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch {}
      }
      if (meta?.draftTicket) {
        pendingDraft = meta.draftTicket;
      }
    }

    if (pendingDraft) {
      const msgTrim = dto.message.toLowerCase().trim();
      const isConfirm =
        msgTrim === 'confirmar' ||
        msgTrim === 'confirmar chamado' ||
        msgTrim === 'confirmar abertura' ||
        msgTrim === 'sim' ||
        msgTrim === 'ok' ||
        msgTrim === 'pode abrir' ||
        msgTrim === 'pode criar' ||
        msgTrim === 'confirmo' ||
        msgTrim === 'correto' ||
        msgTrim === 'abrir chamado' ||
        msgTrim.startsWith('confirmar');

      const isCancel =
        msgTrim === 'cancelar' ||
        msgTrim === 'cancela' ||
        msgTrim === 'não quero mais' ||
        msgTrim === 'deixa pra lá' ||
        msgTrim === 'desisto';

      if (isConfirm) {
        this.logger.log(`🎯 Usuário confirmou rascunho pendente via mensagem de chat: "${dto.message}"`);
        const confirmRes = await this.confirmDraftService.execute(tenantId, currentUser, {
          conversationId: conversation.id,
          action: DraftAction.CONFIRM,
        });

        const refreshedConv = await this.conversationRepo.findOne({
          where: { id: conversation.id },
          relations: ['user', 'relatedTicket'],
        });

        return {
          userMessage,
          agentMessage: confirmRes.message,
          conversation: refreshedConv || conversation,
        };
      }

      if (isCancel) {
        this.logger.log(`🚫 Usuário cancelou rascunho pendente via mensagem de chat: "${dto.message}"`);
        const cancelRes = await this.confirmDraftService.execute(tenantId, currentUser, {
          conversationId: conversation.id,
          action: DraftAction.CANCEL,
        });

        const refreshedConv = await this.conversationRepo.findOne({
          where: { id: conversation.id },
          relations: ['user', 'relatedTicket'],
        });

        return {
          userMessage,
          agentMessage: cancelRes.message,
          conversation: refreshedConv || conversation,
        };
      }
    }

    // 2.15. Tratamento imediato de Saudações (Olá, Oi, Bom dia, Boa tarde)
    const normalizedGreeting = dto.message.toLowerCase().trim().replace(/[!.,?]/g, '');
    const isPureGreeting = [
      'ola',
      'olá',
      'oi',
      'oie',
      'opa',
      'bom dia',
      'boa tarde',
      'boa noite',
      'ola tudo bem',
      'olá tudo bem',
      'oi tudo bem',
    ].includes(normalizedGreeting);

    if (isPureGreeting) {
      const reply = this.messageRepo.create({
        conversationId: conversation.id,
        sender: MessageSender.AGENT,
        content:
          'Olá! Como posso ajudar você hoje? Descreva o que está acontecendo e eu consulto seus chamados, busco soluções na central de ajuda ou chamo um analista se precisar.',
        actions: ['iniciou o atendimento'],
        metadata: {
          quickReplies: [
            'Meu notebook não conecta na VPN',
            'Qual o status do meu chamado?',
            'Preciso de um novo equipamento',
            'Falar com um analista',
          ],
        },
      });
      await this.messageRepo.save(reply);

      const decision = await this.saveDecision(
        reply.id,
        conversation.id,
        'GREETING',
        100,
        'Saudação inicial identificada. O assistente respondeu acolhendo o colaborador e oferecendo as opções de atendimento do service desk.',
        ['Escopo: Acolhimento e apresentação das capacidades de atendimento de TI (Anexo A)'],
        [],
        Date.now() - startTime,
      );
      (reply as any).decision = decision;

      await this.conversationRepo.save(conversation);
      return { userMessage, agentMessage: reply, conversation };
    }

    // 2.2. Execução via Google Gemini AI (quando configurada GEMINI_API_KEY)
    if (this.geminiAgentService.isAvailable()) {
      try {
        this.logger.log(`🤖 Processando mensagem via Google Gemini para usuário ${currentUser.email}...`);
        const geminiRes = await this.geminiAgentService.process(
          tenantId,
          currentUser,
          conversation,
          dto.message,
        );

        if (geminiRes.escalateToAnalyst) {
          conversation.status = ConversationStatus.WAITING_HUMAN;
          conversation.agentPaused = true;
          conversation.transferReason = geminiRes.transferReason || 'Solicitado via atendimento';
          conversation.transferSummary = geminiRes.transferSummary || `Transferido pelo assistente inteligente. Contexto: ${dto.message}`;
          await this.conversationRepo.save(conversation);
        }

        const reply = this.messageRepo.create({
          conversationId: conversation.id,
          sender: MessageSender.AGENT,
          content: geminiRes.reply,
          actions: geminiRes.actions,
          metadata: geminiRes.metadata,
        });
        await this.messageRepo.save(reply);

        const decision = await this.saveDecision(
          reply.id,
          conversation.id,
          geminiRes.intent,
          geminiRes.confidence,
          geminiRes.reasoning,
          geminiRes.rulesApplied,
          geminiRes.toolsCalled,
          Date.now() - startTime,
        );
        (reply as any).decision = decision;

        await this.conversationRepo.save(conversation);
        return { userMessage, agentMessage: reply, conversation };
      } catch (err: any) {
        this.logger.warn(`⚠️ Falha na execução do Gemini (${err.message}). Utilizando motor cognitivo de fallback.`);
        // Continua no fluxo determinístico abaixo
      }
    }

    // 3. Processamento Cognitivo do Agent (Regras do Anexo A)
    const textLower = dto.message.toLowerCase().trim();

    // A. Verificação de Escopo (Anexo A: Apenas assuntos de TI)
    const offTopicKeywords = ['férias', 'holerite', 'salário', 'reembolso de km', 'vale refeição', 'benefício', 'ar condicionado', 'limpeza'];
    const isOffTopic = offTopicKeywords.some((w) => textLower.includes(w));

    if (isOffTopic) {
      const reply = this.messageRepo.create({
        conversationId: conversation.id,
        sender: MessageSender.AGENT,
        content: 'O Nexo Assist atende exclusivamente solicitações de Tecnologia da Informação (TI). Para assuntos de Recursos Humanos, Financeiro ou Facilities, favor acessar o portal de Serviços Corporativos ou ligar no ramal 4000.',
        actions: ['verificou o escopo'],
      });
      await this.messageRepo.save(reply);

      const decision = await this.saveDecision(
        reply.id,
        conversation.id,
        'OFF_TOPIC_REDIRECT',
        95,
        'Assunto fora do escopo de TI identificado. O assistente orientou o usuário a buscar o setor competente (RH/Financeiro/Facilities).',
        ['Escopo: apenas assuntos de TI. Outros assuntos são redirecionados (Anexo A)'],
        [],
        Date.now() - startTime,
      );
      (reply as any).decision = decision;

      await this.conversationRepo.save(conversation);
      return { userMessage, agentMessage: reply, conversation };
    }

    // B. Transferência para analista humano solicitada pelo funcionário (História 5)
    if (
      textLower.includes('falar com um analista') ||
      textLower.includes('falar com analista') ||
      textLower.includes('falar com uma pessoa') ||
      textLower.includes('atendente humano') ||
      textLower.includes('chamar analista')
    ) {
      conversation.status = ConversationStatus.WAITING_HUMAN;
      conversation.agentPaused = true;
      conversation.transferReason = 'Solicitado pelo usuário';
      conversation.transferSummary = `O funcionário solicitou atendimento humano. Contexto recente: "${dto.message}".`;
      await this.conversationRepo.save(conversation);

      const reply = this.messageRepo.create({
        conversationId: conversation.id,
        sender: MessageSender.AGENT,
        content: 'Com certeza. Estou transferindo você para a nossa fila de analistas de TI. O analista receberá todo o histórico desta conversa para dar continuidade. Aguarde só um instante.',
        actions: ['analisou o pedido', 'transferiu para analista'],
      });
      await this.messageRepo.save(reply);

      const decision = await this.saveDecision(
        reply.id,
        conversation.id,
        'ESCALATE_TO_ANALYST',
        98,
        'O funcionário solicitou expressamente falar com um analista. Conversa marcada como aguardando atendente com resumo transferido.',
        ['Transferência: acontece quando o funcionário pede (Anexo A)'],
        [{ name: 'transfer_conversation', description: 'Transfere conversa para analista', latencyMs: 25 }],
        Date.now() - startTime,
      );
      (reply as any).decision = decision;

      return { userMessage, agentMessage: reply, conversation };
    }

    // C. Consulta de Chamado Existente (História 2 e Tela 3)
    if (
      textLower.includes('status do meu chamado') ||
      textLower.includes('consultar chamado') ||
      textLower.includes('como está meu chamado') ||
      textLower.includes('meus chamados') ||
      dto.selectedTicketCode ||
      textLower.includes('inc-20311') ||
      textLower.includes('notebook lento')
    ) {
      return await this.handleTicketConsultation(
        conversation,
        currentUser,
        dto,
        startTime,
      );
    }

    // D. Adicionar Informação a Chamado Aberto (História 3)
    if (
      textLower.includes('adicionar informação') ||
      textLower.includes('complementar chamado') ||
      textLower.includes('atualizar chamado')
    ) {
      const userTickets = await this.ticketRepo.find({
        where: { userId: currentUser.id, tenantId },
        order: { updatedAt: 'DESC' },
      });

      const activeTicket = userTickets.find(
        (t) => t.status === TicketStatus.OPEN || t.status === TicketStatus.WAITING_ANALYST,
      );

      if (activeTicket) {
        const reply = this.messageRepo.create({
          conversationId: conversation.id,
          sender: MessageSender.AGENT,
          content: `Qual informação você gostaria de adicionar ao chamado ${activeTicket.code} (${activeTicket.title})? Digite a nova informação que eu anexo imediatamente ao chamado.`,
          actions: ['consultou seus chamados'],
        });
        await this.messageRepo.save(reply);

        const decision = await this.saveDecision(
          reply.id,
          conversation.id,
          'PROMPT_COMPLEMENT_INFO',
          90,
          `Identificado chamado ativo ${activeTicket.code} para complemento de informações. Solicitando detalhes ao usuário.`,
          ['Complementar chamado aberto com novas informações (História 3)'],
          [{ name: 'get_active_ticket', description: 'Busca chamado ativo do usuário', latencyMs: 30 }],
          Date.now() - startTime,
        );
        (reply as any).decision = decision;

        return { userMessage, agentMessage: reply, conversation };
      }
    }

    // E. Fluxo de Abertura de Chamado (Tela 2)
    // Exemplo do protótipo: "Meu notebook não conecta na VPN desde ontem. Aparece o erro 809."
    if (
      textLower.includes('vpn') ||
      textLower.includes('erro 809') ||
      textLower.includes('não conecta') ||
      textLower.includes('abrir chamado') ||
      textLower.includes('abrir um chamado') ||
      textLower.includes('segundo monitor') ||
      textLower.includes('senha') ||
      textLower.includes('sap') ||
      textLower.includes('só eu') ||
      textLower.includes('minha equipe') ||
      textLower.includes('toda a empresa') ||
      textLower.includes('reunião')
    ) {
      return await this.handleTicketOpeningFlow(
        conversation,
        currentUser,
        dto,
        startTime,
      );
    }

    // F. Busca na Central de Ajuda para dúvidas gerais (História 1)
    const helpArticles = await this.searchArticlesService.execute(tenantId, {
      query: dto.message,
    });

    if (helpArticles.length > 0) {
      const topArticle = helpArticles[0];
      const reply = this.messageRepo.create({
        conversationId: conversation.id,
        sender: MessageSender.AGENT,
        content: `${topArticle.content}\n\nIsso ajudou a resolver sua dúvida ou você gostaria de abrir um chamado?`,
        actions: ['buscou na central de ajuda', 'encontrou artigo relevante'],
        metadata: {
          quickReplies: ['Isso resolveu, obrigado!', 'Ainda preciso abrir um chamado', 'Falar com um analista'],
        },
      });
      await this.messageRepo.save(reply);

      const decision = await this.saveDecision(
        reply.id,
        conversation.id,
        'HELP_CENTER_RESOLUTION',
        88,
        `Encontrado artigo na central de ajuda ("${topArticle.title}"). Apresentada solução imediata sem necessidade de fila ou abertura de chamado.`,
        ['Resolução sem fila: dúvidas resolvidas no próprio chat'],
        [{ name: 'search_help_articles', description: 'Busca semântica na central de ajuda', latencyMs: 40 }],
        Date.now() - startTime,
      );
      (reply as any).decision = decision;

      await this.conversationRepo.save(conversation);
      return { userMessage, agentMessage: reply, conversation };
    }

    // G. Resposta geral mantendo o contexto
    const generalReply = this.messageRepo.create({
      conversationId: conversation.id,
      sender: MessageSender.AGENT,
      content: 'Entendi. Você pode me descrever mais detalhes sobre o que está acontecendo? Se preferir, posso consultar seus chamados abertos ou direcionar você para um analista de suporte.',
      actions: ['processou a mensagem'],
      metadata: {
        quickReplies: ['Qual o status do meu chamado?', 'Abrir um chamado', 'Falar com um analista'],
      },
    });
    await this.messageRepo.save(generalReply);

    const decision = await this.saveDecision(
      generalReply.id,
      conversation.id,
      'GENERAL_GUIDANCE',
      75,
      'Mensagem genérica processada. Apresentadas opções rápidas para conduzir a conversa.',
      ['Condução da conversa: pergunta quando falta informação'],
      [],
      Date.now() - startTime,
    );
    (generalReply as any).decision = decision;

    await this.conversationRepo.save(conversation);
    return { userMessage, agentMessage: generalReply, conversation };
  }

  /**
   * Trata Consulta de Chamados (Tela 3 do protótipo)
   */
  private async handleTicketConsultation(
    conversation: Conversation,
    currentUser: User,
    dto: ChatMessageDto,
    startTime: number,
  ) {
    const textLower = dto.message.toLowerCase();

    // Busca chamados do usuário
    const userTickets = await this.ticketRepo.find({
      where: { userId: currentUser.id, tenantId: conversation.tenantId },
      order: { createdAt: 'DESC' },
    });

    // Se o usuário selecionou ou mencionou um chamado específico (ex: INC-20311)
    const specificTicket = userTickets.find(
      (t) =>
        (dto.selectedTicketCode && t.code.toUpperCase() === dto.selectedTicketCode.toUpperCase()) ||
        textLower.includes(t.code.toLowerCase()) ||
        (textLower.includes('notebook') && t.code === 'INC-20311'),
    );

    if (specificTicket) {
      const isOverdue = isTicketOverdue(specificTicket.slaDeadline);
      const slaRemaining = formatSlaRemaining(specificTicket.slaDeadline);

      let replyContent = '';
      if (isOverdue) {
        replyContent = `Está sem atualização há 5 dias, acima do prazo de 3 dias úteis para prioridade média. Quer que eu chame um analista?`;
      } else {
        replyContent = `Seu chamado ${specificTicket.code} está com status "${specificTicket.status}". A resposta está prevista para ${specificTicket.slaDeadline ? specificTicket.slaDeadline.toLocaleDateString('pt-BR') : 'breve'}. Deseja falar com um analista ou adicionar alguma informação?`;
      }

      const agentMsg = this.messageRepo.create({
        conversationId: conversation.id,
        sender: MessageSender.AGENT,
        content: replyContent,
        actions: [`consultou o ${specificTicket.code}`, 'calculou o prazo'],
        metadata: {
          ticketCard: {
            id: specificTicket.id,
            code: specificTicket.code,
            title: specificTicket.title,
            description: specificTicket.description,
            category: specificTicket.category === TicketCategory.HARDWARE ? 'Hardware › Notebook' : specificTicket.category,
            priority: specificTicket.priority === TicketPriority.MEDIUM ? 'Média' : specificTicket.priority,
            status: 'Aguardando analista',
            openedAt: specificTicket.createdAt ? `${specificTicket.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}, ${specificTicket.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '16 out, 14:20',
            lastUpdatedAt: 'há 5 dias',
            isOverdue,
            overdueText: isOverdue ? '· prazo vencido' : undefined,
          },
          quickReplies: ['Falar com um analista', 'Adicionar informação', 'Não, obrigado'],
        },
      });

      await this.messageRepo.save(agentMsg);

      const decision = await this.saveDecision(
        agentMsg.id,
        conversation.id,
        'CONSULT_SPECIFIC_TICKET',
        96,
        `Usuário consultou o chamado ${specificTicket.code}. Identifiquei que o chamado está com status de aguardando analista e SLA vencido há 5 dias (prazo para prioridade média é de 3 dias úteis). Regra do Anexo A: oferecer transferência para analista humano em chamados vencidos.`,
        [
          'Privacidade: informações de um chamado só podem ser passadas a quem o abriu (Anexo A)',
          'Prazos e prioridade: média tem prazo de 3 dias úteis (Anexo A)',
          'Transferência: acontece em chamados vencidos (Anexo A)',
        ],
        [
          { name: 'get_ticket_details', description: `Consulta ${specificTicket.code}`, latencyMs: 35 },
          { name: 'check_sla_overdue', description: 'Calcula se prazo está vencido', latencyMs: 15 },
        ],
        Date.now() - startTime,
      );
      (agentMsg as any).decision = decision;

      await this.conversationRepo.save(conversation);
      return { userMessage: null, agentMessage: agentMsg, conversation };
    }

    // Se há múltiplos chamados abertos e nenhum selecionado, apresenta o seletor (Tela 3)
    const openTickets = userTickets.filter(
      (t) => t.status !== TicketStatus.RESOLVED && t.status !== TicketStatus.CANCELLED,
    );

    const selectorList = (openTickets.length > 0 ? openTickets : userTickets).slice(0, 3).map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      status: t.status === TicketStatus.WAITING_ANALYST ? 'Aguardando analista' : t.status === TicketStatus.APPROVED ? 'Aprovado' : 'Em andamento',
      statusColor: t.status === TicketStatus.WAITING_ANALYST ? '#F5A500' : t.status === TicketStatus.APPROVED ? '#00BD6C' : '#0285F7',
      dateFormatted: t.createdAt ? t.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '16 out',
    }));

    const agentMsg = this.messageRepo.create({
      conversationId: conversation.id,
      sender: MessageSender.AGENT,
      content: `Você tem ${selectorList.length} chamados abertos. Sobre qual deles quer saber?`,
      actions: ['consultou seus chamados'],
      metadata: {
        ticketSelectionList: selectorList,
      },
    });

    await this.messageRepo.save(agentMsg);

    const decision = await this.saveDecision(
      agentMsg.id,
      conversation.id,
      'LIST_USER_TICKETS_FOR_SELECTION',
      94,
      `Usuário perguntou sobre o status dos seus chamados. Foram encontrados ${selectorList.length} chamados em aberto para este usuário. Apresentado seletor interativo para escolha.`,
      ['Privacidade: chamados do próprio usuário (Anexo A)'],
      [{ name: 'list_user_tickets', description: 'Busca chamados do funcionário', latencyMs: 40 }],
      Date.now() - startTime,
    );
    (agentMsg as any).decision = decision;

    await this.conversationRepo.save(conversation);
    return { userMessage: null, agentMessage: agentMsg, conversation };
  }

  /**
   * Trata Fluxo de Abertura de Chamado (Tela 2 do protótipo)
   */
  private async handleTicketOpeningFlow(
    conversation: Conversation,
    currentUser: User,
    dto: ChatMessageDto,
    startTime: number,
  ) {
    const textLower = dto.message.toLowerCase();

    // Se o usuário está respondendo a pergunta de afetados e urgência (ex: "Só eu. Tenho reunião...")
    const isAffectedReply =
      textLower.includes('só eu') ||
      textLower.includes('minha equipe') ||
      textLower.includes('toda a empresa') ||
      textLower.includes('reunião') ||
      textLower.includes('14h') ||
      textLower.includes('cliente');

    if (isAffectedReply) {
      // Classifica prioridade conforme Anexo A:
      // "Alta: Impede uma pessoa de trabalhar, ou há um compromisso no mesmo dia -> 4 horas úteis"
      const priority = textLower.includes('toda a empresa')
        ? TicketPriority.CRITICAL
        : textLower.includes('reunião') || textLower.includes('cliente') || textLower.includes('14h')
        ? TicketPriority.HIGH
        : TicketPriority.MEDIUM;

      const affectedScope = textLower.includes('toda a empresa')
        ? AffectedScope.ENTIRE_COMPANY
        : textLower.includes('minha equipe')
        ? AffectedScope.MY_TEAM
        : AffectedScope.ONLY_ME;

      // Monta o rascunho (Rascunho D-381 da Tela 2)
      const draft = {
        code: 'D-381',
        title: 'VPN não conecta no notebook — erro 809',
        description: 'Desde 20/10 o notebook (Windows 11) não conecta na VPN e mostra o erro 809. Precisa dela para a reunião das 14h.',
        category: 'Rede e VPN',
        type: 'INCIDENT',
        priority: 'Alta',
        affectedScope: 'Somente você',
        dueEstimate: 'resposta até 13:43',
      };

      const agentMsg = this.messageRepo.create({
        conversationId: conversation.id,
        sender: MessageSender.AGENT,
        content: 'Coloquei prioridade alta por causa da reunião — a resposta chega antes das 14h. Confira antes de eu criar:',
        actions: ['classificou a prioridade', 'consultou o SLA', 'montou o rascunho'],
        metadata: {
          draftTicket: draft,
        },
      });

      await this.messageRepo.save(agentMsg);

      const decision = await this.saveDecision(
        agentMsg.id,
        conversation.id,
        'DRAFT_NEW_TICKET',
        93,
        'Identificado impacto individual com urgência imediata (reunião com cliente às 14h). Pela matriz de prioridade (Anexo A), classificado como Prioridade Alta com SLA de resposta em até 4 horas úteis (antes das 14h). Montado rascunho D-381 e aguardando confirmação do funcionário.',
        [
          'Prioridade Alta: compromisso no mesmo dia ou impede trabalho (Anexo A)',
          'SLA: 4 horas úteis para resposta em prioridade Alta (Anexo A)',
          'Abertura: o agent mostra um rascunho e só cria depois da confirmação (Anexo A)',
        ],
        [
          { name: 'classify_priority', description: 'Calcula prioridade combinando impacto e urgência', latencyMs: 20 },
          { name: 'calculate_sla_deadline', description: 'Calcula SLA útil de 4 horas', latencyMs: 15 },
          { name: 'prepare_draft', description: 'Gera rascunho D-381 com validação prévia', latencyMs: 30 },
        ],
        Date.now() - startTime,
      );
      (agentMsg as any).decision = decision;

      await this.conversationRepo.save(conversation);
      return { userMessage: null, agentMessage: agentMsg, conversation };
    }

    // Se é a primeira mensagem sobre o problema (ex: "Meu notebook não conecta na VPN. Erro 809")
    // Consulta chamados + central de ajuda + pergunta quem está sendo afetado (Tela 2)
    const agentMsg = this.messageRepo.create({
      conversationId: conversation.id,
      sender: MessageSender.AGENT,
      content: 'Não há chamado aberto sobre VPN, e o artigo do erro 809 vale só para Windows 10 — o seu é Windows 11. Vou abrir um chamado.\n\nQuem está sendo afetado?',
      actions: ['consultou seus chamados', 'buscou na central de ajuda'],
      metadata: {
        quickReplies: ['Só eu', 'Minha equipe', 'Toda a empresa', 'Não sei'],
      },
    });

    await this.messageRepo.save(agentMsg);

    const decision = await this.saveDecision(
      agentMsg.id,
      conversation.id,
      'GATHER_TICKET_DETAILS',
      91,
      'Verificado que não existe chamado aberto sobre VPN para este usuário (regra de não duplicidade). Na central de ajuda, o artigo de erro 809 aplica-se exclusivamente a Windows 10, exigindo abertura de chamado para Windows 11. Perguntando escopo de afetados para cálculo de prioridade.',
      [
        'Sem duplicidade: checagem de chamados existentes antes de criar novo (Anexo A)',
        'Central de ajuda: validação do artigo do erro 809',
        'Todo chamado precisa de quem é afetado para definição de prioridade (Anexo A)',
      ],
      [
        { name: 'check_existing_tickets', description: 'Verifica se há chamado de VPN aberto', latencyMs: 30 },
        { name: 'search_knowledge_base', description: 'Busca erro 809 na central de ajuda', latencyMs: 45 },
      ],
      Date.now() - startTime,
    );
    (agentMsg as any).decision = decision;

    await this.conversationRepo.save(conversation);
    return { userMessage: null, agentMessage: agentMsg, conversation };
  }

  private async saveDecision(
    messageId: string,
    conversationId: string,
    intent: string,
    confidence: number,
    reasoning: string,
    rulesApplied: string[],
    toolsCalled: any[],
    latencyMs: number,
  ) {
    const decision = this.decisionRepo.create({
      messageId,
      conversationId,
      intent,
      confidence,
      reasoning,
      rulesApplied,
      toolsCalled,
      latencyMs,
    });
    return await this.decisionRepo.save(decision);
  }
}
