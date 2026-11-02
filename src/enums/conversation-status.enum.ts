export enum ConversationStatus {
  WITH_AGENT = 'WITH_AGENT',             // Com o assistente
  WAITING_HUMAN = 'WAITING_HUMAN',       // Aguardando atendente / Para você
  IN_ATTENDANCE = 'IN_ATTENDANCE',       // Analista assumiu (agent pausado)
  RESOLVED = 'RESOLVED',                 // Resolvida
  CLOSED = 'CLOSED',                     // Encerrada
}

