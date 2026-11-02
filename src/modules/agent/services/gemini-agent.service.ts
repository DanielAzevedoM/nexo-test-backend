import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleGenAI } from '@google/genai';
import { User } from '../../../entities/user.entity';
import { Conversation } from '../../../entities/conversation.entity';
import { Ticket } from '../../../entities/ticket.entity';
import { HelpArticle } from '../../../entities/help-article.entity';
import { Message } from '../../../entities/message.entity';
import { TicketStatus } from '../../../enums/ticket-status.enum';
import { TicketPriority } from '../../../enums/ticket-priority.enum';
import { TicketCategory } from '../../../enums/ticket-category.enum';
import { TicketType } from '../../../enums/ticket-type.enum';
import { SearchArticlesService } from '../../help-center/services/search-articles.service';
import { isTicketOverdue, formatDueEstimate } from '../../../utils/sla.utils';

export interface GeminiAgentResult {
  reply: string;
  actions: string[];
  intent: string;
  confidence: number;
  reasoning: string;
  rulesApplied: string[];
  toolsCalled: Array<{ name: string; description: string; latencyMs: number }>;
  metadata?: {
    quickReplies?: string[];
    draftTicket?: any;
    ticketCard?: any;
    ticketSelectionList?: any[];
  };
  escalateToAnalyst?: boolean;
  transferReason?: string;
  transferSummary?: string;
}

@Injectable()
export class GeminiAgentService {
  private readonly logger = new Logger(GeminiAgentService.name);
  private ai: GoogleGenAI | null = null;
  private readonly modelName: string;
  private readonly apiKey: string | null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(HelpArticle)
    private readonly articleRepo: Repository<HelpArticle>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly searchArticlesService: SearchArticlesService,
  ) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || process.env.GEMINI_API_KEY || null;
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

    if (this.apiKey && this.apiKey !== 'your_gemini_api_key_here') {
      try {
        this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        this.logger.log(`🤖 Google Gemini AI Initialized successfully with model: ${this.modelName}`);
      } catch (err: any) {
        this.logger.error(`❌ Failed to initialize GoogleGenAI: ${err.message}`);
        this.ai = null;
      }
    } else {
      this.logger.warn(
        '⚠️ GEMINI_API_KEY não configurada no .env. Configure GEMINI_API_KEY para habilitar inferência em tempo real com Gemini.',
      );
    }
  }

  isAvailable(): boolean {
    return this.ai !== null;
  }

  /**
   * Processa a mensagem do usuário utilizando o Google Gemini com as regras do Anexo A
   */
  async process(
    tenantId: string,
    currentUser: User,
    conversation: Conversation,
    userMessage: string,
  ): Promise<GeminiAgentResult> {
    const startTime = Date.now();
    const toolsCalled: Array<{ name: string; description: string; latencyMs: number }> = [];

    // 1. Busca contexto prévio (últimas mensagens da conversa)
    const recentMessages = await this.messageRepo.find({
      where: { conversationId: conversation.id },
      order: { createdAt: 'ASC' },
      take: 12,
    });

    // 2. Busca chamados do usuário para contexto imediato
    const t0 = Date.now();
    const userTickets = await this.ticketRepo.find({
      where: { userId: currentUser.id, tenantId },
      order: { createdAt: 'DESC' },
    });
    toolsCalled.push({
      name: 'get_user_tickets',
      description: `Consultou ${userTickets.length} chamados do usuário`,
      latencyMs: Date.now() - t0,
    });

    // 3. Busca artigos da central de ajuda relevantes
    const t1 = Date.now();
    const helpArticles = await this.searchArticlesService.execute(tenantId, { query: userMessage });
    toolsCalled.push({
      name: 'search_knowledge_base',
      description: `Buscou na central de ajuda (${helpArticles.length} artigos encontrados)`,
      latencyMs: Date.now() - t1,
    });

    // Contexto dos chamados formatado para a IA
    const ticketsContext = userTickets.map((t) => ({
      code: t.code,
      title: t.title,
      category: t.category,
      type: t.type,
      priority: t.priority,
      status: t.status,
      isOverdue: isTicketOverdue(t.slaDeadline),
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
    }));

    // Contexto dos artigos formatado para a IA
    const kbContext = helpArticles.map((a) => ({
      title: a.title,
      category: a.category,
      content: a.content,
    }));

    // System prompt estritamente baseado no Anexo A do PRD
    const systemInstruction = `
Você é o Nexo Assist, o assistente conversacional inteligente do service desk de TI da Nexo (empresa com 2.000 funcionários).
Sua missão é atender os funcionários da Nexo com clareza, empatia, agilidade e total transparência.

REGRAS OBRIGATÓRIAS DO SERVICE DESK (ANEXO A):
1. ESCOPO EXCLUSIVO DE TI:
   - Atenda APENAS solicitações e dúvidas de Tecnologia da Informação (acessos, softwares, computadores, rede, VPN, impressoras, sistemas corporativos como SAP).
   - Qualquer assunto de Recursos Humanos (férias, holerite, benefícios), Financeiro (reembolso de KM) ou Facilities (ar condicionado, limpeza) DEVE ser redirecionado educadamente orientando a acessar o portal de Serviços Corporativos ou ligar no ramal 4000.

2. TIPOS E CATEGORIAS DE CHAMADO:
   - INCIDENTE (INC): quando algo parou de funcionar ou quebrou (ex: VPN com erro 809, senha bloqueada, notebook lento).
   - REQUISIÇÃO (REQ): pedido de novo acesso, software ou equipamento (ex: segundo monitor, liberação de pasta).
   - Categorias permitidas: Acesso, Rede e VPN, Hardware, Software, E-mail, Outros.

3. MATRIZ DE PRIORIDADE E PRAZOS (SLA):
   - Crítica: algo parado para uma equipe inteira ou para toda a empresa -> Prazo: 1 hora.
   - Alta: impede uma pessoa de trabalhar OU há um compromisso/reunião no mesmo dia -> Prazo: 4 horas úteis.
   - Média: atrapalha o trabalho, mas há alternativa disponível -> Prazo: 3 dias úteis.
   - Baixa: pedidos e melhorias sem urgência -> Prazo: 5 dias úteis.

4. PREVENÇÃO DE DUPLICIDADE (REGRA CRÍTICA):
   - Consulte OBRIGATORIAMENTE os chamados atuais do usuário ('Chamados atuais deste usuário').
   - Se já existe chamado ABERTO ou EM ANDAMENTO sobre o mesmo problema (ex: VPN, lentidão, tela azul, acesso):
     - NÃO proponha abrir novo chamado.
     - Diga claramente que o chamado já existe e que você irá ATUALIZÁ-LO com as novas informações para não duplicar.
     - Forneça 'draftTicket' contendo 'existingTicketCode': '[CÓDIGO]' e 'title': 'Atualização de [CÓDIGO]'.
   - Chamados RESOLVIDOS:
     - Se resolvido há até 7 dias: informe que pode ser reaberto sem necessidade de novo chamado e pergunte se o usuário deseja reabrir.
     - Se resolvido há mais de 7 dias: explique que chamados com mais de 7 dias de resolução não podem ser reabertos conforme as regras da Nexo, e ofereça abertura de novo chamado.

5. RASCUNHO ANTES DE ABRIR (OBRIGATÓRIO):
   - Todo chamado precisa de: título, descrição, tipo, categoria, prioridade e escopo de afetados.
   - O agent NUNCA cria o chamado no banco diretamente: ele mostra SEMPRE um rascunho (código provisório D-XXX) com os dados e pede a confirmação explícita do funcionário.
   - Apenas quando o funcionário confirma é que o chamado é gravado no sistema.

6. CENTRAL DE AJUDA:
   - Dúvidas gerais que a base de conhecimento responde (ex: VPN erro 809 no Windows 10, portal de senhas id.nexo.com.br, SAP) devem ser explicadas diretamente no chat para resolver sem fila.
   - Se o artigo só vale para Windows 10 e o usuário usa Windows 11, explique a diferença e ofereça abertura de chamado.

7. TRANSFERÊNCIA PARA ANALISTA HUMANO (ANEXO A):
   Acontece OBRIGATORIAMENTE em qualquer uma das 4 situações:
   a) O funcionário pede para falar com um analista/atendente/humano.
   b) Em casos críticos (escopo 'Toda a empresa' ou prioridade Crítica).
   c) Em chamados com prazo de SLA vencido (isOverdue: true).
   d) Quando você não tiver segurança para decidir (confiança < 50%).
   - Ao transferir: defina 'escalateToAnalyst': true, 'transferReason' e 'transferSummary' (resumo completo do caso para o analista).

8. PADRONIZAÇÃO ESTRITA DE BOTÕES DE SELEÇÃO (quickReplies):
   Para garantir uniformidade idêntica entre TODOS os funcionários:
   - Ao perguntar quem está sendo afetado: use SEMPRE EXATAMENTE: ['Só eu', 'Minha equipe', 'Toda a empresa', 'Não sei']
   - Ao perguntar impacto ou urgência no trabalho: use SEMPRE EXATAMENTE: ['Estou totalmente parado', 'Consigo trabalhar com limitações', 'Não afeta meu trabalho hoje']
   - Ao apresentar rascunho de chamado: use SEMPRE EXATAMENTE: ['Confirmar chamado', 'Editar dados', 'Cancelar']
   - Ao sugerir falar com analista após consulta ou dúvida: use SEMPRE: ['Ver meus chamados', 'Falar com um analista']
   - Ao responder com artigo da central de ajuda: use SEMPRE: ['Resolveu minha dúvida', 'Ainda preciso de ajuda', 'Falar com um analista']
   - Ao tratar de reabertura: use SEMPRE: ['Reabrir chamado', 'Abrir novo chamado', 'Falar com analista']
   NUNCA use termos diferentes ou sinônimos para essas opções!

DADOS REAIS DO CONTEXTO ATUAL:
- Usuário Atual: ${currentUser.name} (${currentUser.email}, Depto: ${currentUser.department})
- Chamados atuais deste usuário: ${JSON.stringify(ticketsContext, null, 2)}
- Artigos relevantes encontrados na Central de Ajuda: ${JSON.stringify(kbContext, null, 2)}

INSTRUÇÕES DE SAÍDA:
Você DEVE responder EXCLUSIVAMENTE em formato JSON com o seguinte schema estrito:
{
  "reply": "Sua resposta amigável e concisa em português brasileiro",
  "actions": ["lista de ações executadas em texto curto, ex: consultou seus chamados, buscou na central de ajuda, classificou a prioridade, montou o rascunho"],
  "intent": "Nome da intenção em SCREAMING_SNAKE_CASE (ex: GATHER_TICKET_DETAILS, DRAFT_NEW_TICKET, CONSULT_SPECIFIC_TICKET, HELP_CENTER_RESOLUTION, OFF_TOPIC_REDIRECT, ESCALATE_TO_ANALYST)",
  "confidence": 95,
  "reasoning": "Explicação detalhada em português do que você entendeu, por que tomou essa ação e quais critérios utilizou",
  "rulesApplied": ["lista textual das regras do Anexo A aplicadas nesta decisão"],
  "escalateToAnalyst": false,
  "transferReason": null,
  "transferSummary": null,
  "metadata": {
    "quickReplies": ["opcional: opções rápidas em botões para o usuário clicar"],
    "draftTicket": null ou {
      "code": "D-381",
      "title": "título do chamado",
      "description": "descrição completa do problema",
      "category": "Rede e VPN",
      "type": "INCIDENT ou REQUEST",
      "priority": "Alta, Média, Crítica ou Baixa",
      "affectedScope": "Somente você, Minha equipe ou Toda a empresa",
      "dueEstimate": "resposta até 13:43 ou prazo estimado",
      "existingTicketId": null
    },
    "ticketCard": null ou {
      "code": "INC-20311",
      "title": "título",
      "category": "Hardware",
      "priority": "Média",
      "status": "Aguardando analista",
      "lastUpdatedAt": "há 5 dias",
      "isOverdue": true,
      "overdueText": "· prazo vencido"
    },
    "ticketSelectionList": null ou [
      { "id": "id", "code": "INC-20311", "title": "título", "status": "Aguardando analista", "statusColor": "#F5A500", "dateFormatted": "26 de out." }
    ]
  }
}
`;

    // Constrói o histórico da conversa
    const historyText = recentMessages
      .map((m) => `${m.sender === 'USER' ? 'Funcionário' : 'Nexo Assist'}: ${m.content}`)
      .join('\n');

    const prompt = `
Histórico recente da conversa:
${historyText}

Nova mensagem do funcionário:
"${userMessage}"

Analise a mensagem, aplique as regras do Anexo A e gere a resposta JSON completa.`;

    const candidateModels = Array.from(
      new Set([
        this.modelName,
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash',
        'gemini-3-flash-preview',
        'gemini-3.8-flash',
      ]),
    );

    let lastError: any = null;
    for (const model of candidateModels) {
      try {
        const response = await this.ai!.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.2, // Baixa temperatura para máximo determinismo e observância das regras
          },
        });

        const responseText = response.text?.trim() || '{}';
        const parsed = JSON.parse(responseText);

        const latencyMs = Date.now() - startTime;
        toolsCalled.push({
          name: 'gemini_inference',
          description: `Inferência com modelo ${model}`,
          latencyMs,
        });

        const normalizedReplies = this.normalizeQuickReplies(parsed.metadata?.quickReplies);
        const metadata = parsed.metadata || {};
        if (normalizedReplies) {
          metadata.quickReplies = normalizedReplies;
        }

        return {
          reply: parsed.reply || 'Como posso te ajudar com suporte de TI hoje?',
          actions: Array.isArray(parsed.actions) && parsed.actions.length > 0
            ? parsed.actions
            : ['processou a mensagem com IA'],
          intent: parsed.intent || 'GENERAL_ASSISTANCE',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 92,
          reasoning: parsed.reasoning || 'Mensagem processada pelo Gemini com base no contexto do service desk.',
          rulesApplied: Array.isArray(parsed.rulesApplied) ? parsed.rulesApplied : ['Regras do Service Desk Nexo (Anexo A)'],
          toolsCalled,
          metadata,
          escalateToAnalyst: parsed.escalateToAnalyst === true,
          transferReason: parsed.transferReason || undefined,
          transferSummary: parsed.transferSummary || undefined,
        };
      } catch (err: any) {
        lastError = err;
        this.logger.warn(`⚠️ Tentativa com modelo ${model} falhou: ${err.message}. Tentando próximo candidato...`);
      }
    }

    this.logger.error(`❌ Todos os modelos candidatos do Gemini falharam: ${lastError?.message}. Ativando fallback determinístico.`);
    throw lastError;
  }

  /**
   * Normaliza deterministicamente as opções de botões para manter consistência idêntica
   * entre todos os colaboradores independente da variação semântica do LLM
   */
  private normalizeQuickReplies(replies?: string[]): string[] | undefined {
    if (!replies || !Array.isArray(replies) || replies.length === 0) return undefined;

    const lower = replies.map((r) => r.toLowerCase().trim());

    // 1. Escopo / Afetados
    if (lower.some((r) => r.includes('só eu') || r.includes('minha equipe') || r.includes('empresa') || r.includes('afetad'))) {
      return ['Só eu', 'Minha equipe', 'Toda a empresa', 'Não sei'];
    }

    // 2. Confirmação de Rascunho
    if (lower.some((r) => r.includes('confirmar') || r.includes('abertura') || r.includes('abrir') || r.includes('rascunho'))) {
      return ['Confirmar chamado', 'Editar dados', 'Cancelar'];
    }

    // 3. Impacto / Urgência
    if (lower.some((r) => r.includes('parado') || r.includes('limitaç') || r.includes('trabalho'))) {
      return ['Estou totalmente parado', 'Consigo trabalhar com limitações', 'Não afeta meu trabalho hoje'];
    }

    // 4. Central de Ajuda
    if (lower.some((r) => r.includes('resolveu') || r.includes('dúvida') || r.includes('ajudou'))) {
      return ['Resolveu minha dúvida', 'Ainda preciso de ajuda', 'Falar com um analista'];
    }

    // 5. Chamados / Consulta
    if (lower.some((r) => r.includes('meus chamados') || r.includes('chamado'))) {
      return ['Ver meus chamados', 'Falar com um analista'];
    }

    return replies;
  }
}

