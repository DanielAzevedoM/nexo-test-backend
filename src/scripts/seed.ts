import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Ticket } from '../entities/ticket.entity';
import { HelpArticle } from '../entities/help-article.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { AgentDecision } from '../entities/agent-decision.entity';
import { UserRole } from '../enums/user-role.enum';
import { TicketType } from '../enums/ticket-type.enum';
import { TicketCategory } from '../enums/ticket-category.enum';
import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { AffectedScope } from '../enums/affected-scope.enum';
import { ConversationStatus } from '../enums/conversation-status.enum';
import { MessageSender } from '../enums/message-sender.enum';

export async function runSeed(dataSource: DataSource) {
  console.log('🌱 Starting database seed for Nexo Assist...');

  const userRepo = dataSource.getRepository(User);
  const ticketRepo = dataSource.getRepository(Ticket);
  const articleRepo = dataSource.getRepository(HelpArticle);
  const convRepo = dataSource.getRepository(Conversation);
  const msgRepo = dataSource.getRepository(Message);
  const decisionRepo = dataSource.getRepository(AgentDecision);

  // 1. Seed Users (Funcionários e Analista)
  const usersData = [
    {
      name: 'Ana Souza',
      email: 'ana.souza@nexo.com.br',
      department: 'Financeiro',
      role: UserRole.EMPLOYEE,
    },
    {
      name: 'Carla Mendes',
      email: 'carla.mendes@nexo.com.br',
      department: 'Vendas',
      role: UserRole.EMPLOYEE,
    },
    {
      name: 'Bruno Tavares',
      email: 'bruno.tavares@nexo.com.br',
      department: 'Engenharia',
      role: UserRole.EMPLOYEE,
    },
    {
      name: 'Diego Ramos',
      email: 'diego.ramos@nexo.com.br',
      department: 'Marketing',
      role: UserRole.EMPLOYEE,
    },
    {
      name: 'Elisa Prado',
      email: 'elisa.prado@nexo.com.br',
      department: 'Operações',
      role: UserRole.EMPLOYEE,
    },
    {
      name: 'Fábio Nunes',
      email: 'fabio.nunes@nexo.com.br',
      department: 'Produto',
      role: UserRole.EMPLOYEE,
    },
    {
      name: 'Gabriela Rocha',
      email: 'gabriela.rocha@nexo.com.br',
      department: 'Jurídico',
      role: UserRole.EMPLOYEE,
    },
    {
      name: 'Roberto Lima',
      email: 'roberto.lima@nexo.com.br',
      department: 'Service Desk N2',
      role: UserRole.ANALYST,
    },
    {
      name: 'Usuário Teste',
      email: 'teste@nexo.com.br',
      department: 'Tecnologia & Inovação',
      role: UserRole.EMPLOYEE,
    },
    {
      name: 'Analista de Suporte',
      email: 'analista@nexo.com.br',
      department: 'Service Desk N1/N2',
      role: UserRole.ANALYST,
    },
    {
      name: 'Analista Teste',
      email: 'analista.teste@nexo.com.br',
      department: 'Service Desk N2',
      role: UserRole.ANALYST,
    },
  ];

  const savedUsers: Record<string, User> = {};
  for (const u of usersData) {
    let existing = await userRepo.findOne({ where: { email: u.email } });
    if (!existing) {
      existing = userRepo.create({
        tenantId: 'nexo-corp',
        name: u.name,
        email: u.email,
        department: u.department,
        role: u.role,
        isActive: true,
      });
      await userRepo.save(existing);
    }
    savedUsers[u.email] = existing;
  }
  console.log('✅ Users seeded.');

  // 2. Seed Help Articles (Central de Ajuda - Anexo B)
  const articlesData = [
    {
      title: 'VPN com erro 809',
      category: TicketCategory.NETWORK_VPN,
      summary: 'Como solucionar erro 809 ao conectar na VPN corporativa.',
      content:
        'VPN com erro 809: reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.',
      tags: 'vpn, erro 809, rede, windows 10, windows 11',
    },
    {
      title: 'Horário do service desk',
      category: TicketCategory.OTHER,
      summary: 'Horários de atendimento e regime de plantão.',
      content:
        'Horário do service desk: de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.',
      tags: 'horario, atendimento, plantao, suporte',
    },
    {
      title: 'Senha do SAP bloqueada',
      category: TicketCategory.ACCESS,
      summary: 'Procedimento para desbloqueio ou redefinição de senha do SAP.',
      content:
        'Para desbloquear sua senha do SAP, acesse o portal de autoatendimento em id.nexo.com.br e utilize seu segundo fator de autenticação. Se o bloqueio persistir, solicite o reset via service desk.',
      tags: 'sap, senha, bloqueio, acesso',
    },
    {
      title: 'Segundo monitor para home office',
      category: TicketCategory.HARDWARE,
      summary: 'Regras e aprovação para solicitação de monitor adicional.',
      content:
        'A solicitação de segundo monitor para home office requer aprovação do gestor direto no portal de compras e política de elegibilidade para modelo híbrido.',
      tags: 'monitor, home office, equipamento, hardware',
    },
    {
      title: 'Conexão Wi-Fi de visitantes e funcionários',
      category: TicketCategory.NETWORK_VPN,
      summary: 'Como conectar à rede sem fio Nexo-Corp e Nexo-Guest.',
      content:
        'A rede Wi-Fi corporativa "Nexo-Corp" requer autenticação 802.1X com as credenciais de rede. Visitantes devem usar a rede "Nexo-Guest" solicitando voucher na recepção.',
      tags: 'wifi, wireless, rede, visitantes, internet',
    },
    {
      title: 'Configuração de e-mail corporativo no celular',
      category: TicketCategory.EMAIL,
      summary: 'Passo a passo para configurar o Outlook no smartphone.',
      content:
        'Para configurar seu e-mail no smartphone (iOS/Android), instale o Microsoft Outlook pelo portal de aplicativos da empresa e faça login com autenticação de dois fatores.',
      tags: 'email, outlook, celular, mobile, smartphone',
    },
    {
      title: 'Lentidão após atualização do Windows',
      category: TicketCategory.HARDWARE,
      summary: 'Diagnóstico inicial para computadores lentos pós-atualização.',
      content:
        'Caso o notebook apresente lentidão após atualização do Windows, execute a ferramenta de diagnóstico da central de suporte, desative inicialização automática de programas pesados e reinicie a máquina. Se persistir, abra um chamado.',
      tags: 'notebook, lentidao, windows, atualizacao, hardware',
    },
  ];

  for (const a of articlesData) {
    const existing = await articleRepo.findOne({ where: { title: a.title } });
    if (!existing) {
      const article = articleRepo.create({
        tenantId: 'nexo-corp',
        ...a,
        isActive: true,
      });
      await articleRepo.save(article);
    }
  }
  console.log('✅ Help center articles seeded.');

  // 3. Seed Tickets (Anexo B)
  const ana = savedUsers['ana.souza@nexo.com.br'];
  const carla = savedUsers['carla.mendes@nexo.com.br'];
  const bruno = savedUsers['bruno.tavares@nexo.com.br'];
  const roberto = savedUsers['roberto.lima@nexo.com.br'];
  const teste = savedUsers['teste@nexo.com.br'];
  const analista = savedUsers['analista@nexo.com.br'] || savedUsers['analista.teste@nexo.com.br'];

  // Data base para simular tickets abertos há alguns dias
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  const ticketsData = [
    {
      code: 'INC-34919',
      userId: teste.id,
      title: 'VPN não conecta no notebook — erro 809',
      description:
        'Desde 20/10 o notebook (Windows 11) não conecta na VPN e mostra o erro 809. Precisa dela para a reunião das 14h.',
      type: TicketType.INCIDENT,
      category: TicketCategory.NETWORK_VPN,
      priority: TicketPriority.LOW,
      status: TicketStatus.IN_PROGRESS,
      affectedScope: AffectedScope.ONLY_ME,
      assignedAnalystId: analista?.id,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      code: 'INC-30101',
      userId: teste.id,
      title: 'Notebook reiniciando aleatoriamente',
      description: 'A tela fica azul (BSOD) durante reuniões no Teams.',
      type: TicketType.INCIDENT,
      category: TicketCategory.HARDWARE,
      priority: TicketPriority.LOW,
      status: TicketStatus.IN_PROGRESS,
      affectedScope: AffectedScope.ONLY_ME,
      createdAt: daysAgo(4),
      updatedAt: daysAgo(3),
    },
    {
      code: 'REQ-30102',
      userId: teste.id,
      title: 'Solicitação de acesso ao GitHub corporativo',
      description: 'Acesso aos repositórios do time de desenvolvimento.',
      type: TicketType.REQUEST,
      category: TicketCategory.ACCESS,
      priority: TicketPriority.LOW,
      status: TicketStatus.WAITING_ANALYST,
      affectedScope: AffectedScope.ONLY_ME,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      code: 'INC-20311',
      userId: ana.id,
      title: 'Notebook lento após atualização do Windows',
      description:
        'Lentidão geral desde a atualização de 15/10. Reiniciar e rodar o diagnóstico da central não resolveu.',
      type: TicketType.INCIDENT,
      category: TicketCategory.HARDWARE,
      priority: TicketPriority.MEDIUM,
      status: TicketStatus.WAITING_ANALYST,
      affectedScope: AffectedScope.ONLY_ME,
      createdAt: daysAgo(6),
      updatedAt: daysAgo(5),
      slaDeadline: daysAgo(3), // Vencido!
    },
    {
      code: 'INC-20298',
      userId: ana.id,
      title: 'Acesso à pasta Financeiro no SharePoint',
      description: 'Permissão de leitura e escrita para novos relatórios contábeis de 2026.',
      type: TicketType.INCIDENT,
      category: TicketCategory.ACCESS,
      priority: TicketPriority.MEDIUM,
      status: TicketStatus.IN_PROGRESS,
      affectedScope: AffectedScope.ONLY_ME,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
      slaDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    },
    {
      code: 'REQ-10442',
      userId: ana.id,
      title: 'Segundo monitor para home office',
      description: 'Solicitação de tela de 24 polegadas para atividades de conciliação financeira.',
      type: TicketType.REQUEST,
      category: TicketCategory.HARDWARE,
      priority: TicketPriority.LOW,
      status: TicketStatus.APPROVED,
      affectedScope: AffectedScope.ONLY_ME,
      createdAt: daysAgo(7),
      updatedAt: daysAgo(6),
      slaDeadline: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    },
    {
      code: 'INC-20150',
      userId: ana.id,
      title: 'Senha do SAP bloqueada',
      description: 'Tentativa incorreta de login 3 vezes consecutivas.',
      type: TicketType.INCIDENT,
      category: TicketCategory.ACCESS,
      priority: TicketPriority.MEDIUM,
      status: TicketStatus.RESOLVED,
      affectedScope: AffectedScope.ONLY_ME,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(4),
      closedAt: daysAgo(4), // Resolvido há 4 dias (pode reabrir, <= 7 dias)
    },
    {
      code: 'INC-19800',
      userId: ana.id,
      title: 'Teclado com defeito na tecla espaço',
      description: 'Substituição de teclado externo USB.',
      type: TicketType.INCIDENT,
      category: TicketCategory.HARDWARE,
      priority: TicketPriority.LOW,
      status: TicketStatus.RESOLVED,
      affectedScope: AffectedScope.ONLY_ME,
      createdAt: daysAgo(20),
      updatedAt: daysAgo(15),
      closedAt: daysAgo(15), // Resolvido há 15 dias (> 7 dias, não pode reabrir)
    },
    {
      code: 'REQ-10450',
      userId: carla.id,
      title: 'Preciso de acesso ao SAP ainda hoje',
      description: 'Fechamento de propostas comerciais do trimestre exige acesso ao módulo SD.',
      type: TicketType.REQUEST,
      category: TicketCategory.ACCESS,
      priority: TicketPriority.HIGH,
      status: TicketStatus.WAITING_ANALYST,
      affectedScope: AffectedScope.ONLY_ME,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      slaDeadline: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    },
    {
      code: 'INC-20410',
      userId: bruno.id,
      title: 'Erro de certificado SSL ao acessar sistema interno',
      description: 'Ambiente de testes inacessível para o time de desenvolvimento.',
      type: TicketType.INCIDENT,
      category: TicketCategory.NETWORK_VPN,
      priority: TicketPriority.HIGH,
      status: TicketStatus.WAITING_ANALYST,
      affectedScope: AffectedScope.MY_TEAM,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
      slaDeadline: new Date(now.getTime() + 3 * 60 * 60 * 1000),
    },
  ];

  const savedTickets: Record<string, Ticket> = {};
  for (const t of ticketsData) {
    let existing = await ticketRepo.findOne({ where: { code: t.code } });
    if (!existing) {
      existing = ticketRepo.create({
        tenantId: 'nexo-corp',
        ...t,
      });
      await ticketRepo.save(existing);
    }
    savedTickets[t.code] = existing;
  }
  console.log('✅ Tickets seeded.');

  // 4. Seed Pre-configured Conversations for the Analyst Console (Telas 4 e 5) e Chat do Funcionário
  const diego = savedUsers['diego.ramos@nexo.com.br'];
  const fabio = savedUsers['fabio.nunes@nexo.com.br'];
  const gabriela = savedUsers['gabriela.rocha@nexo.com.br'];

  // Limpa conversas e mensagens anteriores do seed para garantir consistência total dos testes
  await msgRepo.createQueryBuilder().delete().execute();
  await convRepo.createQueryBuilder().delete().execute();

  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);

  // 1. Usuário Teste (teste@nexo.com.br) - Conversa limpa inicial pronta para o avaliador interagir
  const convTeste = convRepo.create({
    tenantId: 'nexo-corp',
    userId: teste.id,
    status: ConversationStatus.WITH_AGENT,
    agentPaused: false,
    messageCount: 1,
    lastMessageAt: minutesAgo(5),
  });
  await convRepo.save(convTeste);

  const testeWelcome = msgRepo.create({
    conversationId: convTeste.id,
    sender: MessageSender.AGENT,
    content:
      'Olá! Sou o Nexo Assist, seu assistente do service desk de TI. Descreva o que está acontecendo e eu consulto seus chamados, busco soluções na central de ajuda ou chamo um analista se precisar.',
    actions: ['iniciou o atendimento'],
    metadata: {
      quickReplies: [
        'Meu notebook não conecta na VPN',
        'Qual o status do meu chamado?',
        'Preciso de um novo equipamento',
        'Falar com um analista',
      ],
    },
    createdAt: minutesAgo(5),
  });
  await msgRepo.save(testeWelcome);

  // 2. Ana Souza - Tela 3 & Tela 4 (Aguardando Atendente / Chamado Vencido INC-20311)
  const convAna = convRepo.create({
    tenantId: 'nexo-corp',
    userId: ana.id,
    status: ConversationStatus.WAITING_HUMAN,
    agentPaused: true,
    relatedTicketId: savedTickets['INC-20311']?.id,
    transferReason: 'Transferida · INC-20311 (SLA vencido)',
    transferSummary:
      'Chamado INC-20311 (Notebook lento após atualização do Windows) sem atualização há 5 dias (prazo de 3 dias úteis vencido). A usuária solicitou transferência para analista humano.',
    messageCount: 6,
    lastMessageAt: minutesAgo(29),
  });
  await convRepo.save(convAna);

  const anaMessages = [
    {
      conversationId: convAna.id,
      sender: MessageSender.USER,
      content: 'Qual o status do meu chamado?',
      createdAt: minutesAgo(35),
    },
    {
      conversationId: convAna.id,
      sender: MessageSender.AGENT,
      content: 'Você tem 3 chamados abertos. Sobre qual deles quer saber?',
      actions: ['consultou seus chamados'],
      metadata: {
        ticketSelectionList: [
          {
            id: savedTickets['INC-20311']?.id,
            code: 'INC-20311',
            title: 'Notebook lento após atualização do Windows',
            status: 'Aguardando analista',
            statusColor: '#F5A500',
            dateFormatted: '16 out',
          },
          {
            id: savedTickets['INC-20298']?.id,
            code: 'INC-20298',
            title: 'Acesso à pasta Financeiro no SharePoint',
            status: 'Em andamento',
            statusColor: '#0062C4',
            dateFormatted: 'há 3 dias',
          },
          {
            id: savedTickets['REQ-10442']?.id,
            code: 'REQ-10442',
            title: 'Segundo monitor para home office',
            status: 'Aprovado',
            statusColor: '#00BD6C',
            dateFormatted: 'há 7 dias',
          },
        ],
      },
      createdAt: minutesAgo(34),
    },
    {
      conversationId: convAna.id,
      sender: MessageSender.USER,
      content: 'INC-20311 · Notebook lento após atualização',
      createdAt: minutesAgo(32),
    },
    {
      conversationId: convAna.id,
      sender: MessageSender.AGENT,
      content:
        'O chamado INC-20311 está sem atualização há 5 dias, acima do prazo de 3 dias úteis para prioridade média. Gostaria que eu transferisse para um analista?',
      actions: ['consultou o INC-20311', 'calculou o prazo (SLA vencido)'],
      metadata: {
        ticketCard: {
          id: savedTickets['INC-20311']?.id,
          code: 'INC-20311',
          title: 'Notebook lento após atualização do Windows',
          description:
            'Lentidão geral desde a atualização de 15/10. Reiniciar e rodar o diagnóstico da central não resolveu.',
          category: 'Hardware',
          priority: 'Média',
          status: 'Aguardando analista',
          openedAt: '16 out, 14:20',
          lastUpdatedAt: 'há 5 dias',
          isOverdue: true,
          overdueText: '· prazo vencido',
        },
        quickReplies: ['Falar com um analista', 'Adicionar informação', 'Não, obrigado'],
      },
      createdAt: minutesAgo(31),
    },
    {
      conversationId: convAna.id,
      sender: MessageSender.USER,
      content: 'Está parado há 5 dias. Quero falar com um analista por favor.',
      createdAt: minutesAgo(30),
    },
    {
      conversationId: convAna.id,
      sender: MessageSender.AGENT,
      content:
        'Com certeza, Ana. Transferi sua conversa para a fila de atendimento humano com prioridade devido ao SLA vencido. O analista receberá todo o histórico e dará continuidade.',
      actions: ['transferiu para analista humano'],
      createdAt: minutesAgo(29),
    },
  ];

  for (const m of anaMessages) {
    const msg = msgRepo.create(m as any);
    await msgRepo.save(msg);
  }

  // 3. Carla Mendes - Tela 4 (Aguardando Atendente / Urgência Comercial SAP SD)
  const convCarla = convRepo.create({
    tenantId: 'nexo-corp',
    userId: carla.id,
    status: ConversationStatus.WAITING_HUMAN,
    agentPaused: true,
    relatedTicketId: savedTickets['REQ-10450']?.id,
    transferReason: 'Transferida · Urgência Comercial',
    transferSummary:
      'Usuária precisa de liberação emergencial do SAP SD para fechamento de vendas às 17h. Caso de alta prioridade com impacto em toda a equipe comercial.',
    messageCount: 6,
    lastMessageAt: minutesAgo(19),
  });
  await convRepo.save(convCarla);

  const carlaMessages = [
    {
      conversationId: convCarla.id,
      sender: MessageSender.USER,
      content: 'Preciso de acesso ao SAP ainda hoje',
      createdAt: minutesAgo(25),
    },
    {
      conversationId: convCarla.id,
      sender: MessageSender.AGENT,
      content:
        'Entendo a urgência, Carla. O acesso ao SAP exige validação de perfil e justificativa de negócio. Para qual módulo você precisa e qual o impacto no trabalho?',
      actions: ['buscou na central de ajuda', 'verificou política de acessos'],
      metadata: {
        quickReplies: ['Módulo SD (Vendas)', 'Módulo FI (Financeiro)', 'Não sei o módulo'],
      },
      createdAt: minutesAgo(24),
    },
    {
      conversationId: convCarla.id,
      sender: MessageSender.USER,
      content:
        'Preciso do módulo SD para emitir os contratos comerciais do trimestre que encerram hoje às 17h. Afeta o time todo de vendas.',
      createdAt: minutesAgo(22),
    },
    {
      conversationId: convCarla.id,
      sender: MessageSender.AGENT,
      content:
        'Identifiquei que esta requisição tem impacto crítico nas operações comerciais de hoje. Vou transferir seu atendimento diretamente para a fila de analistas de Suporte liberar o perfil de emergência.',
      actions: ['classificou prioridade: Alta', 'transferiu para analista'],
      createdAt: minutesAgo(21),
    },
    {
      conversationId: convCarla.id,
      sender: MessageSender.USER,
      content: 'Muito obrigada, fico no aguardo por aqui!',
      createdAt: minutesAgo(20),
    },
    {
      conversationId: convCarla.id,
      sender: MessageSender.AGENT,
      content:
        'Perfeito, Carla! Notificação enviada à equipe de analistas. Você será atendida em instantes.',
      actions: ['notificou analistas'],
      createdAt: minutesAgo(19),
    },
  ];

  for (const m of carlaMessages) {
    const msg = msgRepo.create(m as any);
    await msgRepo.save(msg);
  }

  // 4. Bruno Tavares - Tela 4 (Aguardando Atendente / Insegurança do Agente · Confiança 41%)
  const convBruno = convRepo.create({
    tenantId: 'nexo-corp',
    userId: bruno.id,
    status: ConversationStatus.WAITING_HUMAN,
    agentPaused: true,
    relatedTicketId: savedTickets['INC-20410']?.id,
    transferReason: 'Agent pediu ajuda · confiança 41%',
    transferSummary:
      'Erro de handshake SSL em microsserviços no Kubernetes após renovação de certificados pela infraestrutura. O agente não possui base suficiente para orientar com segurança (confiança 41%).',
    messageCount: 5,
    lastMessageAt: minutesAgo(40),
  });
  await convRepo.save(convBruno);

  const brunoMessages = [
    {
      conversationId: convBruno.id,
      sender: MessageSender.USER,
      content: 'Estou tendo um erro de handshake SSL e timeout no endpoint interno do Kubernetes',
      createdAt: minutesAgo(45),
    },
    {
      conversationId: convBruno.id,
      sender: MessageSender.AGENT,
      content:
        'Consultei nossa central de ajuda sobre certificados SSL e conectividade interna, mas não encontrei um procedimento homologado para erros de handshake SSL no cluster de homologação.',
      actions: ['buscou na central de ajuda', 'avaliou confiança: 41%'],
      createdAt: minutesAgo(44),
    },
    {
      conversationId: convBruno.id,
      sender: MessageSender.USER,
      content: 'Os certificados foram renovados hoje de manhã pelo time de infra. Pode transferir para o suporte N2?',
      createdAt: minutesAgo(42),
    },
    {
      conversationId: convBruno.id,
      sender: MessageSender.AGENT,
      content:
        'Com certeza, Bruno. Como envolve configurações técnicas de cluster fora da base do assistente (confiança 41%), transferi sua conversa diretamente para o time de Suporte N2/DevOps.',
      actions: ['insegurança do agent (41%)', 'transferiu para analista N2'],
      createdAt: minutesAgo(41),
    },
    {
      conversationId: convBruno.id,
      sender: MessageSender.USER,
      content: 'Perfeito, aguardo o retorno do analista N2. Obrigado!',
      createdAt: minutesAgo(40),
    },
  ];

  for (const m of brunoMessages) {
    const msg = msgRepo.create(m as any);
    await msgRepo.save(msg);
  }

  // 5. Diego Ramos - Tela 5 (Analista Atendendo · Aba "Minhas")
  const convDiego = convRepo.create({
    tenantId: 'nexo-corp',
    userId: diego.id,
    status: ConversationStatus.IN_ATTENDANCE,
    agentPaused: true,
    assignedAnalystId: analista.id,
    transferReason: 'Transferida · Equipamento defeituoso',
    transferSummary: 'Mouse sem fio parou de funcionar mesmo trocando as pilhas e portas USB.',
    messageCount: 7,
    lastMessageAt: minutesAgo(46),
  });
  await convRepo.save(convDiego);

  const diegoMessages = [
    {
      conversationId: convDiego.id,
      sender: MessageSender.USER,
      content: 'Oi, meu mouse sem fio parou de funcionar e a pilha não é o problema.',
      createdAt: minutesAgo(60),
    },
    {
      conversationId: convDiego.id,
      sender: MessageSender.AGENT,
      content: 'Você já tentou testar o receptor em outra porta USB ou reiniciar o notebook?',
      actions: ['buscou na central de ajuda'],
      createdAt: minutesAgo(59),
    },
    {
      conversationId: convDiego.id,
      sender: MessageSender.USER,
      content: 'Sim, testei em duas portas diferentes e reiniciei. Nada de sinal.',
      createdAt: minutesAgo(57),
    },
    {
      conversationId: convDiego.id,
      sender: MessageSender.AGENT,
      content:
        'Compreendido. Como o problema físico persiste, vou transferir para a equipe de Service Desk providenciar a troca do equipamento.',
      actions: ['transferiu para analista'],
      createdAt: minutesAgo(56),
    },
    {
      conversationId: convDiego.id,
      sender: MessageSender.ANALYST,
      content:
        'Olá Diego! Analista Teste assumiu seu atendimento. Já separei um kit novo de mouse e teclado sem fio no estoque de TI (sala 302). Pode passar aqui para retirar até as 18h!',
      createdAt: minutesAgo(50),
    },
    {
      conversationId: convDiego.id,
      sender: MessageSender.USER,
      content: 'Maravilha! Vou passar aí agora mesmo para retirar, muito obrigado!',
      createdAt: minutesAgo(48),
    },
    {
      conversationId: convDiego.id,
      sender: MessageSender.ANALYST,
      content:
        'Combinado, Diego! Chamado atualizado e kit reservado no seu nome. Tenha um ótimo dia de trabalho!',
      createdAt: minutesAgo(46),
    },
  ];

  for (const m of diegoMessages) {
    const msg = msgRepo.create(m as any);
    await msgRepo.save(msg);
  }

  // 6. Fábio Nunes - Aba "Com o agent" (Atendimento ativo com o assistente)
  const convFabio = convRepo.create({
    tenantId: 'nexo-corp',
    userId: fabio.id,
    status: ConversationStatus.WITH_AGENT,
    agentPaused: false,
    messageCount: 4,
    lastMessageAt: minutesAgo(71),
  });
  await convRepo.save(convFabio);

  const fabioMessages = [
    {
      conversationId: convFabio.id,
      sender: MessageSender.USER,
      content: 'Como faço para configurar o e-mail corporativo no celular?',
      createdAt: minutesAgo(75),
    },
    {
      conversationId: convFabio.id,
      sender: MessageSender.AGENT,
      content:
        'Para configurar seu e-mail corporativo no smartphone (iOS ou Android), instale o app Microsoft Outlook pelo portal de aplicativos da empresa e faça login com autenticação de dois fatores.',
      actions: ['consultou artigo: Configuração de e-mail no celular'],
      metadata: {
        quickReplies: ['Consegui configurar', 'Apareceu erro de autenticação', 'Falar com analista'],
      },
      createdAt: minutesAgo(74),
    },
    {
      conversationId: convFabio.id,
      sender: MessageSender.USER,
      content: 'Deu super certo! Consegui autenticar pelo aplicativo e sincronizou tudo. Valeu!',
      createdAt: minutesAgo(72),
    },
    {
      conversationId: convFabio.id,
      sender: MessageSender.AGENT,
      content:
        'Excelente, Fábio! Fico feliz que tenha dado tudo certo. Se precisar de mais alguma ajuda de TI, é só me chamar. Tenha um ótimo dia!',
      actions: ['atendimento concluído com sucesso'],
      createdAt: minutesAgo(71),
    },
  ];

  for (const m of fabioMessages) {
    const msg = msgRepo.create(m as any);
    await msgRepo.save(msg);
  }

  // 7. Gabriela Rocha - Encerrada / Resolvida (Histórico finalizado)
  const convGabriela = convRepo.create({
    tenantId: 'nexo-corp',
    userId: gabriela.id,
    status: ConversationStatus.CLOSED,
    agentPaused: true,
    messageCount: 4,
    lastMessageAt: minutesAgo(116),
  });
  await convRepo.save(convGabriela);

  const gabrielaMessages = [
    {
      conversationId: convGabriela.id,
      sender: MessageSender.USER,
      content: 'Qual o horário de atendimento do service desk hoje?',
      createdAt: minutesAgo(120),
    },
    {
      conversationId: convGabriela.id,
      sender: MessageSender.AGENT,
      content:
        'O horário do service desk é de segunda a sexta, das 8h às 18h. Para chamados críticos, temos plantão 24 horas.',
      actions: ['consultou artigo: Horário do service desk'],
      createdAt: minutesAgo(119),
    },
    {
      conversationId: convGabriela.id,
      sender: MessageSender.USER,
      content: 'Ótimo, era só essa dúvida mesmo, muito obrigada!',
      createdAt: minutesAgo(117),
    },
    {
      conversationId: convGabriela.id,
      sender: MessageSender.AGENT,
      content:
        'Por nada, Gabriela! Atendimento finalizado com sucesso. Conte sempre com o Nexo Assist!',
      actions: ['encerrou o atendimento'],
      createdAt: minutesAgo(116),
    },
  ];

  for (const m of gabrielaMessages) {
    const msg = msgRepo.create(m as any);
    await msgRepo.save(msg);
  }

  console.log('✅ Seed completed successfully!');
}

