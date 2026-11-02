# 🤖 Nexo Assist — Agent do Service Desk de TI

> **Desafio Técnico Beyond the Bytes** · Processo Seletivo  
> Solução completa com arquitetura limpa em **NestJS** e **React (TypeScript)**, integração com **Google Gemini** em tempo real, estrita observância das regras de negócio do Service Desk (**Anexo A**), **Console do Analista (N1/N2)** e **Transparência Cognitiva de Decisões**.

REPOSITÓRIO FRONTEND: https://github.com/DanielAzevedoM/nexo-test-backend
---

## 📋 Sumário
- [Visão Geral e Contexto](#-visão-geral-e-contexto)
- [Escolhas de Tecnologia e IA (Google Gemini)](#-escolhas-de-tecnologia-e-ia-google-gemini)
- [Como Rodar o Projeto](#-como-rodar-o-projeto)
  - [Pré-requisitos](#pré-requisitos)
  - [Passo a Passo de Instalação](#passo-a-passo-de-instalação)
  - [Usuários de Demonstração](#usuários-de-demonstração)
- [Regras de Negócio do Service Desk (Anexo A)](#-regras-de-negócio-do-service-desk-anexo-a)
- [Arquitetura e Engenharia de Software](#-arquitetura-e-engenharia-de-software)
- [Transparência das Decisões (Decision Inspector)](#-transparência-das-decisões-decision-inspector)
- [Garantia de Qualidade e Testes Automatizados](#-garantia-de-qualidade-e-testes-automatizados)
- [Trade-offs e Pontos de Melhoria](#-trade-offs-e-pontos-de-melhoria)
  - [1. Sistema de Mensageria e Filas](#1-sistema-de-mensageria-e-filas-rabbitmq--kafka--redis)
  - [2. Matriz Granular de Permissões (RBAC/ABAC por Ações)](#2-matriz-granular-de-permissões-rbacabac-por-ações)
- [Demonstração das Telas e Fluxos do Protótipo](#-demonstração-das-telas-e-fluxos-do-protótipo)

---

## 🎯 Visão Geral e Contexto

A **Nexo** é uma empresa com cerca de 2.000 funcionários. O **Nexo Assist** substitui o antigo formulário manual e burocrático de service desk por um agente conversacional inteligente capaz de:
- **Resolução sem fila**: soluciona dúvidas e consultas diretamente no chat consumindo os artigos da Central de Ajuda em tempo real.
- **Chamados bem abertos e conferidos**: coleta informações com linguagem natural, classifica tipo (`INC` vs `REQ`), categoria e prioridade com base em impacto e urgência, gera um **rascunho provisório de conferência (`D-XXX`)** e só persiste no banco de dados após a confirmação explícita do funcionário.
- **Sem duplicidade**: detecta semanticamente se já existe um chamado aberto ou em andamento sobre o mesmo assunto para aquele colaborador, atualizando o chamado existente em vez de criar registros duplicados.
- **Reabertura em até 7 dias**: permite a reabertura de chamados resolvidos há até 7 dias; após esse período, orienta a criação de um novo chamado.
- **Transferência humanizada com contexto**: quando o funcionário solicita, quando o incidente é crítico (afeta toda a equipe/empresa), quando o prazo de SLA está vencido ou quando o agente não possui segurança para decidir (< 50% de confiança), a conversa é transferida ao Console do Analista com resumo executivo, e **o agente pausa imediatamente suas respostas**.
- **Console do Analista de Suporte**: permite aos analistas N1/N2 visualizar conversas com filtro (*Todas*, *Para você*, *Com o agent*, *Minhas*), assumir atendimentos, trocar mensagens e devolver ao agente ou encerrar o chamado.
- **Transparência cognitiva**: expõe inline as ações executadas e abre o **Decision Inspector**, detalhando intenção, grau de certeza, raciocínio em linguagem natural, regras aplicadas do Anexo A e latência das ferramentas chamadas.

---

## 🤖 Escolhas de Tecnologia e IA (Google Gemini)

### Por que o Google Gemini (`gemini-3.1-flash-lite`)?
Para atender aos requisitos de um service desk com 2.000 funcionários e respostas em tempo real, calibramos o agente no modelo **`gemini-3.1-flash-lite`** (com fallback multi-candidato dinâmico para `gemini-3.5-flash`, `gemini-3-flash-preview` e `gemini-3.8-flash`), integrado via SDK oficial `@google/genai`.

As principais motivações técnicas para esta escolha foram:

1. **Latência Ultra-baixa (< 1.5s)**:  
   Em um chat conversacional de atendimento, latências superiores a 4 segundos geram sensação de lentidão e frustração no colaborador. A família Flash Lite oferece tempo de resposta praticamente instantâneo, mantendo o diálogo fluido.
2. **Excelente Custo-Benefício em Escala Corporativa**:  
   Com milhares de interações diárias geradas por 2.000 colaboradores, o custo por milhão de tokens é uma fração de modelos como Claude Opus ou GPT-4o, viabilizando economicamente a operação contínua do assistente corporativo.
3. **Structured Outputs Nativos (`responseMimeType: 'application/json'`)**:  
   O Gemini suporta retorno estruturado em JSON com schema estrito. Isso elimina alucinações de formatação e garante que o backend receba de forma determinística:
   - Texto de resposta (`reply`);
   - Ações executadas (`actions`);
   - Intenção classificada (`intent`);
   - Grau de confiança percentual (`confidence`);
   - Raciocínio explicativo (`reasoning`);
   - Regras aplicadas do Anexo A (`rulesApplied`);
   - Dados de rascunho de conferência (`draftTicket`), cartão de chamado (`ticketCard`) e botões rápidos (`quickReplies`).
4. **Interpretação de Contexto Cruzado e Regras Complexas**:  
   O modelo processa em uma única passagem: o histórico das últimas mensagens, a lista de chamados reais do colaborador salvos no banco de dados MySQL e os artigos relevantes da Central de Ajuda. Ele é capaz de identificar, por exemplo, que um artigo da Central sobre o erro 809 de VPN só é válido para Windows 10, e como o usuário está no Windows 11, deve-se propor a abertura de chamado.
5. **Padronização Estrita dos Botões (`quickReplies`)**:  
   Para garantir que **todos os funcionários recebam exatamente as mesmas opções** em cada situação (sem variações criativas do LLM), desenvolvemos uma camada determinística pós-inferência (`normalizeQuickReplies`):
   - Escopo de afetados: sempre `['Só eu', 'Minha equipe', 'Toda a empresa', 'Não sei']`.
   - Impacto/Urgência: sempre `['Estou totalmente parado', 'Consigo trabalhar com limitações', 'Não afeta meu trabalho hoje']`.
   - Confirmação de chamado: sempre `['Confirmar chamado', 'Editar dados', 'Cancelar']`.
   - Consulta e dúvidas: sempre `['Ver meus chamados', 'Falar com um analista']`.
6. **Resiliência e Fallback Cognitivo**:  
   Caso a API externa sofra indisponibilidade de rede ou falha de cota, o sistema aciona de forma transparente um motor cognitivo determinístico offline com heurísticas e regras estritas do Anexo A, garantindo que o colaborador nunca fique sem resposta.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- **Docker** e **Docker Compose** instalados (para o container MySQL 8.4)
- **Node.js 18+** instalado (`node -v`)
- **npm** instalado (`npm -v`)
- Git

---

### Passo a Passo de Instalação

#### 1. Clonar o Repositório
```bash
git clone <url-do-repositorio>
cd nexus-test
```

#### 2. Subir o Banco de Dados MySQL via Docker
O projeto conta com container MySQL 8.4 pré-configurado via Docker Compose:
```bash
docker compose up -d
```
> O container `nexo_assist_db` subirá na porta padrão `3306` com a base de dados `nexo_assist` pronta para uso.

#### 3. Instalar as Dependências
O backend e o frontend são projetos desacoplados e independentes. Instale as dependências de cada um:

```bash
# 3.1 Instalar dependências do Backend (NestJS)
cd backend
npm install

# 3.2 Instalar dependências do Frontend (React + Vite)
cd ../frontend
npm install
```

#### 4. Variáveis de Ambiente

##### Backend (`backend/.env`):
Caso crie o arquivo a partir do modelo:
```bash
cd backend
cp .env.example .env
```
O arquivo `backend/.env` contém as configurações de porta, CORS, banco de dados MySQL e chave do **Google Gemini**:
```env
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database (MySQL 8.4 via Docker)
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=root
DB_DATABASE=nexo_assist

# JWT Secret
JWT_SECRET=nexo_assist_super_secret_jwt_key_2026
JWT_EXPIRES_IN=7d

# Google Gemini API
GEMINI_API_KEY=sua_chave_do_google_gemini_aqui
GEMINI_MODEL=gemini-3.1-flash-lite
```

##### Frontend (`frontend/.env`):
Caso crie o arquivo a partir do modelo:
```bash
cd frontend
cp .env.example .env
```
O arquivo `frontend/.env` configura a URL base da API consumida pelo cliente HTTP (Axios):
```env
VITE_API_URL=http://localhost:3000/api
```

#### 5. Executar as Aplicações

Abra dois terminais independentes:

**Terminal 1 — Backend (NestJS)**:
```bash
cd backend
npm run start:dev
```
> O backend iniciará na porta **`http://localhost:3000`** e conectará ao MySQL do Docker.  
> O auto-seed será executado automaticamente criando usuários, artigos da base de conhecimento com busca vetorial e chamados de demonstração.  
> Documentação interativa Swagger disponível em: **`http://localhost:3000/api/docs`**.

**Terminal 2 — Frontend (React + Vite)**:
```bash
cd frontend
npm run dev
```
> O frontend iniciará na porta **`http://localhost:5173`**.

Abra o navegador em: **[http://localhost:5173](http://localhost:5173)**. *(Caso prefira executar via raiz, atalhos `npm run start:backend` e `npm run start:frontend` também estão disponíveis)*.

---

### 👥 Usuários de Demonstração

A tela de login aceita os funcionários dos dados de exemplo com qualquer senha (conforme especificado no PRD). Além disso, inclui **botões de atalho rápido em 1 clique** para preenchimento imediato:

| Perfil | Nome | E-mail Corporativo | Senha | Cenários Disponíveis |
|---|---|---|---|---|
| **Funcionário** | Usuário Teste | `teste@nexo.com.br` | *qualquer* | Perfil padrão de testes, chamados em andamento de VPN e hardware, abertura de novos chamados, visualização da tela de perfil completa. |
| **Funcionária** | Ana Souza | `ana.souza@nexo.com.br` | *qualquer* | Chamado `INC-20311` com SLA vencido, teste de triagem de VPN (Windows 10 vs 11). |
| **Funcionário** | Bruno Tavares | `bruno.tavares@nexo.com.br` | *qualquer* | Chamados de SAP e segundo monitor. |
| **Analista N1/N2** | Analista Teste | `analista@nexo.com.br` | *qualquer* | Acesso ao **Console do Analista**: fila de espera, assumir atendimentos, devolver ao agente, encerrar chamados. |

---

## 📜 Regras de Negócio do Service Desk (Anexo A)

Todo o comportamento do assistente e dos serviços de backend foi validado com base nas regras do **Anexo A**:

1. **Escopo Exclusivo de TI**:
   - Assuntos de RH (férias, holerite), Financeiro (reembolso) ou Facilities (ar condicionado) são educadamente redirecionados para o portal de Serviços Corporativos ou ramal 4000.
2. **Tipos e Categorias Canônicas**:
   - `INCIDENT` (`INC`): algo que parou de funcionar ou quebrou.
   - `REQUEST` (`REQ`): pedido de novo acesso, software ou equipamento.
   - Categorias: *Acesso*, *Rede e VPN*, *Hardware*, *Software*, *E-mail*, *Outros*.
3. **Matriz de Prioridade e Prazos de SLA (Horas Úteis e Dias)**:
   - **Crítica** (Equipe ou empresa inteira parada): **1 hora**.
   - **Alta** (Impede pessoa de trabalhar OU reunião/compromisso no mesmo dia): **4 horas úteis**.
   - **Média** (Atrapalha mas há alternativa): **3 dias úteis**.
   - **Baixa** (Pedidos e melhorias): **5 dias úteis**.
4. **Sem Duplicidade**:
   - Caso exista um chamado em aberto com o mesmo assunto, o agente avisa o colaborador e complementa o chamado existente, bloqueando a criação de duplicatas.
5. **Reabertura de Chamados**:
   - Chamados resolvidos há até 7 dias podem ser reabertos com justificativa; acima de 7 dias, a reabertura é bloqueada e orienta-se a abertura de um novo chamado.
6. **Rascunho de Conferência Obrigatório**:
   - O agente **nunca abre o chamado diretamente**. Ele apresenta o cartão com código provisório (`D-XXX`), tipo, categoria, prioridade, afetados e prazo estimado, exigindo a confirmação do usuário.
7. **Transferência e Silêncio do Agente**:
   - Ocorre por: solicitação do usuário, incidente crítico, SLA vencido ou insegurança do agente.
   - O agente gera resumo estruturado e entra em pausa (`agentPaused: true`).
   - Enquanto pausado, o agente **não responde nenhuma mensagem** até ser liberado pelo analista.

---

## 🏛️ Arquitetura e Engenharia de Software

O backend foi construído seguindo **Clean Architecture** e princípios **SOLID** em **NestJS**, com desacoplamento rigoroso entre domínio, regras de negócio e adaptadores:

```
backend/
├── src/
│   ├── entities/               # Entidades TypeORM (User, Ticket, Conversation, Message, Decision, Article)
│   ├── enums/                  # Enums canônicos (TicketType, TicketCategory, TicketPriority, TicketStatus)
│   ├── guards/                 # JwtAuthGuard, RolesGuard
│   ├── interceptors/           # TransformInterceptor ({ data: T }), LoggingInterceptor
│   ├── utils/                  # sla.utils.ts (cálculo de prazos úteis, detecção de atraso)
│   ├── modules/
│   │   ├── auth/               # Autenticação JWT e emissão de tokens
│   │   ├── users/              # Consulta de perfis e departamentos
│   │   ├── help-center/        # Base de conhecimento e busca por palavras-chave
│   │   ├── tickets/            # CRUD de chamados, sistema legado resiliente e reabertura
│   │   ├── conversations/      # Sessões de chat, atribuição de analistas, encerramento
│   │   └── agent/              # GeminiAgentService, ConfirmDraftService, Decision Transparency
│   └── scripts/seed.ts         # Povoamento inicial com dados realistas
```

### Destaques Arquiteturais:
- **Use Case Services isolados**: Cada caso de uso é uma classe com método único `execute()` (ex: `CreateTicketService`, `ConfirmDraftService`, `AssignAnalystService`).
- **Resiliência do Sistema Legado**: A classe `LegacyTicketSystemService` simula o comportamento do sistema legado de chamados mencionado no PRD (latências de rede e indisponibilidades esporádicas), aplicando retry exponencial e circuit breaker com fallback gracioso.
- **Sincronização Reativa**: Atualizações de chamados disparam eventos de versão (`ticketsVersion`) que atualizam instantaneamente a barra lateral do usuário e a gaveta de chamados sem requisições manuais.

---

## 🔍 Transparência das Decisões (Decision Inspector)

Conforme solicitado no PRD (*"Transparência: é possível entender o que o agent fez e por quê em cada resposta"*):

1. **Ações Inline**: Acima de cada resposta do assistente são exibidas pílulas visuais das ações executadas (ex: `✓ consultou seus chamados`, `✓ buscou na central de ajuda`, `✓ calculou prioridade`).
2. **Botão "Ver Decisão" (Console do Analista)**: Exclusivo para analistas de suporte no Console do Analista (garantindo interface limpa e focada para o funcionário final), o botão abre o **Decision Inspector Drawer** deslizante contendo:
   - **Intenção Detectada**: ex: `DRAFT_NEW_TICKET`, `ESCALATE_TO_ANALYST`, `RESOLVE_VIA_HELP_CENTER`.
   - **Barra de Confiança**: Grau de certeza percentual (ex: 95%).
   - **Raciocínio Explicativo**: Justificativa detalhada do que o modelo compreendeu e dos critérios usados.
   - **Regras do Anexo A Aplicadas**: Relação textual das regras do service desk que embasaram a resposta.
   - **Rastreabilidade de Ferramentas (Tool Calling)**: Tabela com as funções acionadas (`get_user_tickets`, `search_knowledge_base`, `gemini_inference`), argumentos e latências em milissegundos.

---

## 🧪 Garantia de Qualidade e Testes Automatizados

O backend conta com uma suíte de testes unitários abrangente utilizando **Vitest**:

```bash
cd backend
npm test
```

### Cobertura de Testes:
- **`sla.utils.spec.ts`**: Cálculo de prazos em horas úteis (8h às 18h), dias úteis, prazos de 1h/4h/3d/5d e detecção de SLA vencido.
- **`create-ticket.service.spec.ts`**: Criação de chamados, cálculo de SLA e **bloqueio de duplicidade (ConflictException)** quando já existe chamado aberto com assunto similar.
- **`reopen-ticket.service.spec.ts`**: Validação da regra de reabertura em até 7 dias após a resolução e bloqueio quando exceder o prazo.
- **`process-agent-message.service.spec.ts`**:
  - Limite de 30 mensagens por sessão;
  - Redirecionamento de assuntos fora do escopo de TI;
  - Transferência para analista humano com resumo e motivo;
  - **Pausa obrigatória do agente** quando a conversa estiver com o analista humano;
  - Processamento via Google Gemini com Structured Output;
  - Interceptação de confirmação de rascunho por mensagem de chat e criação direta no banco de dados.

**Resultado dos testes:**
```
✓ src/utils/sla.utils.spec.ts (4 tests)
✓ src/modules/tickets/services/reopen-ticket.service.spec.ts (2 tests)
✓ src/modules/tickets/services/create-ticket.service.spec.ts (2 tests)
✓ src/modules/agent/services/process-agent-message.service.spec.ts (6 tests)

Test Files  4 passed (4)
     Tests  14 passed (14)
```

---

## ⚖️ Trade-offs e Pontos de Melhoria

### 1. Sistema de Mensageria e Filas (RabbitMQ / Kafka / Redis)
- **Cenário Atual**: As mensagens do chat e as operações de persistência de chamados ocorrem de forma síncrona via HTTP REST.
- **Melhoria Arquitetural**: Para um ambiente de produção de alto volume, a introdução de uma fila de mensageria (ex: **RabbitMQ** ou **Redis BullMQ**) traria:
  - **Desacoplamento do Sistema Legado**: A criação de chamados no sistema legado (sujeito a indisponibilidades) seria enfileirada e reprocessada em background com políticas de retry exponencial e Dead-Letter Queue (DLQ).
  - **Event-Driven Architecture**: Emissão de eventos como `TicketCreatedEvent`, `ConversationTransferredEvent`, permitindo que outros microsserviços (ex: envio de e-mails, métricas de SLA, notificações push) consumam os eventos sem onerar a requisição do chat.

---

### 2. Matriz Granular de Permissões (RBAC/ABAC por Ações)
- **Verificação do PRD**:  
  Revisamos minuciosamente o documento do desafio técnico e o PRD: **não foi solicitado nenhum sistema, módulo ou persona de Administrador de Sistema (Admin)**, tampouco gestão de usuários, tela de cadastro de cargos ou painel de liberação de rotas. O escopo concentrou-se exclusivamente nas duas personas centrais de atendimento: o **Funcionário** e o **Analista do Service Desk (N1/N2)**.
- **Como foi implementado no projeto**:  
  Utilizamos autenticação JWT com papéis canônicos segregados (`UserRole.EMPLOYEE` e `UserRole.ANALYST`) protegidos por `JwtAuthGuard` e `RolesGuard`. Isso garante que:
  - Funcionários só conseguem visualizar seus próprios chamados e abrir conversas para si mesmos, respeitando a regra de privacidade do Anexo A (*"Privacidade: informações de um chamado só podem ser passadas a quem o abriu"*);
  - Apenas analistas têm permissão para listar conversas transferidas, assumir atendimentos, enviar mensagens operacionais e encerrar chamados.
- **Melhoria Arquitetural para Escala Corporativa**:  
  Em uma evolução de produto, pode-se implementar um sistema granular de permissões por ação (*Action-Based Guards*), com permissões atômicas como:
  - `employee:tickets:create`, `employee:tickets:view`, `employee:tickets:edit`;
  - `analyst:conversations:assign`, `analyst:conversations:message`, `analyst:tickets:resolve`;
  - `admin:users:manage`, `admin:roles:configure`.  
  Essas permissões seriam validadas via decorator personalizado `@RequirePermissions(Permission.TICKET_CREATE)` e um guard `PermissionsGuard` verificando claims na sessão.

---

## 🎨 Demonstração das Telas e Fluxos do Protótipo

A interface web foi desenvolvida no frontend espelhando com precisão milimétrica o design system do protótipo **Pencil**:

### 1. Tela de Login Corporativo (`/login`)
- Visual minimalista ocupando a tela inteira em tom branco e bordas `#E6E8EC`.
- Entrada por e-mail e senha corporativa.
- Cards informativos sobre as capacidades do Nexo Assist.
- **Atalhos rápidos de teste**: Botões para login instantâneo como Funcionário (`teste@nexo.com.br`) ou Analista (`analista@nexo.com.br`).

### 2. Chat do Funcionário (`/chat`)
- **Menu Lateral Esquerdo**: Logo Nexo Assist, botão `+ Nova conversa`, abas `Atendimento`, `Meus Chamados` (com badge numérico em tempo real) e `Meu perfil`.
- **Área de Conversa**:
  - Respostas do assistente com chips de ação inline (`consultou seus chamados`, `buscou na central de ajuda`).
  - **Cartão de Rascunho (`D-XXX`)**: Título, descrição, categoria, prioridade com estimativa de prazo, botões de ação `Confirmar` (com atalho `⌘↵`), `Editar` e `Cancelar`.
  - **Botões Rápidos Padronizados**: Pílulas de seleção de afetados (`Só eu`, `Minha equipe`, `Toda a empresa`, `Não sei`), urgência e reabertura.
- **Barra de Digitação**: Limite de 30 mensagens da sessão com contador visual (`1/30`) e bloqueio automático quando a conversa estiver com o analista humano.

### 3. Tela Completa "Meu Perfil" (`Cliente — Meu perfil`)
- Implementação integral como tela principal (substituindo modais popup conforme o protótipo Pencil):
  - Cabeçalho com breadcrumb: `Service desk de TI > Meu perfil`.
  - **Card de Dados**: Nome e e-mail corporativo reais do colaborador com o selo com ícone de cadeado *"Gerenciado pela TI"*.
  - **Card de Senha**: Indicador *"Alterada há 42 dias"*, botão funcional *"Redefinir senha"* e aviso informativo *"Enviaremos um link de redefinição para {email}"* com feedback visual imediato de envio.

### 4. Gaveta Lateral "Meus Chamados"
- Desliza da direita para a esquerda sobre a área principal:
  - Campo de busca em tempo real por código ou descrição.
  - Filtros rápidos: `Todos`, `Abertos` e `Resolvidos`.
  - Cartões de chamado com código (`INC-XXXXX`), categoria, prioridade, selo de status (*Aberto*, *Em andamento*, *Resolvido*), analista responsável e botão `Ver no chat`.
  - **Fechamento Inteligente**: Fecha automaticamente ao clicar no backdrop externo ou ao pressionar a tecla `ESC`.

### 5. Console do Analista (`/analyst`)
- **Barra Lateral de Atendimentos**:
  - Filtros por abas: `Todas`, `Para você` (aguardando atendimento), `Com o agent` e `Minhas`.
  - Indicadores de status: *Agent atendendo*, *Solicitado pelo usuário*, *SLA vencido*, *Incidente Crítico*.
- **Painel Central de Atendimento**:
  - Histórico completo da conversa entre o funcionário e o agente.
  - Banner explicativo de motivo e resumo da transferência.
  - Botão **Assumir Atendimento** (pausa o agente, vincula o analista ao chamado no banco e libera o campo de resposta humana).
  - Ações operacionais: **Devolver ao Assistente** (reativa o agente) e **Encerrar Atendimento** (marca o chamado como resolvido no banco).
- **Gaveta de Chamados do Funcionário**: Painel lateral exibindo todos os chamados abertos e histórico prévio daquele colaborador para contextualizar o analista sem perguntas repetidas.

---

<p align="center">
  <b>Nexo Assist</b> — Atendimento de TI inteligente, transparente e humanizado para a Nexo.
</p>
