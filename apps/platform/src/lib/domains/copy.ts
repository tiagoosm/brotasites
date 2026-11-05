// The client's own domain in the client's words (E25): the states, the reasons and what to do.
// Shared by the site's page, the notices and the tests. pt-BR, short, no jargon.

export type DomainStatus = "pending" | "verifying" | "active" | "failed" | "removed";
export type DomainFailure = "dns_missing" | "timeout" | "refused" | "conflict";

export const domainStatus: Record<DomainStatus, { label: string; text: string }> = {
  pending: {
    label: "Aguardando configuração",
    text: "Crie os registros abaixo no site onde você registrou o domínio. Depois, toque em Verificar agora.",
  },
  verifying: {
    label: "Verificando",
    text: "Ainda não encontramos os registros. A mudança pode levar algumas horas para aparecer: conferimos sozinhos todos os dias por 7 dias.",
  },
  active: {
    label: "Ativo",
    text: "Seu domínio está funcionando. O endereço da BrotaSites continua valendo e leva ao principal.",
  },
  failed: {
    label: "Com problema",
    text: "Não conseguimos verificar o seu domínio.",
  },
  removed: { label: "Removido", text: "O domínio foi desconectado do site." },
};

export const domainFailure: Record<DomainFailure, string> = {
  dns_missing:
    "Os registros não estão mais no seu domínio. Confira se foram apagados ou mudados no registrador e tente de novo.",
  timeout:
    "Passaram 7 dias sem encontrarmos os registros. Confira se foram criados exatamente como abaixo e tente de novo.",
  refused:
    "O domínio não pôde ser conectado. Confira se ele está registrado em seu nome e se não usa outro serviço que esconde o DNS, e tente de novo.",
  conflict:
    "Esse domínio já está conectado em outro serviço. Desconecte lá primeiro e tente de novo.",
};

/** What each record is for, in plain words. */
export const recordPurpose: Record<string, string> = {
  route: "Leva o domínio até o seu site",
  ownership: "Mostra que o domínio é seu",
  certificate: "Permite o cadeado de site seguro (https)",
};
