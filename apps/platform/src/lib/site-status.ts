// What each site status means to the client (docs/product.md, Site status). pt-BR.

export type SiteStatus =
  | "draft"
  | "generating_directions"
  | "awaiting_direction_choice"
  | "building"
  | "in_review"
  | "awaiting_approval"
  | "publishing"
  | "live"
  | "needs_attention"
  | "suspended"
  | "grace"
  // Schema 1.1 sites, from before the identity engine.
  | "generating"
  | "failed";

export interface StatusInfo {
  label: string;
  /** A sentence for the status card. */
  text: string;
  /** The system is working: the dashboard refreshes on its own. */
  busy: boolean;
  /** The client has something to do. */
  yourTurn: boolean;
}

export const statusInfo: Record<SiteStatus, StatusInfo> = {
  draft: {
    label: "Rascunho",
    text: "Suas respostas ficam salvas. Continue de onde parou.",
    busy: false,
    yourTurn: true,
  },
  generating_directions: {
    label: "Criando as 3 direções",
    text: "Pode fechar a página. As direções aparecem aqui quando ficarem prontas.",
    busy: true,
    yourTurn: false,
  },
  awaiting_direction_choice: {
    label: "Escolha uma das 3",
    text: "As 3 direções estão prontas. Escolha a que tem mais a sua cara.",
    busy: false,
    yourTurn: true,
  },
  building: {
    label: "Montando seu site",
    text: "Estamos escrevendo os textos e montando as páginas com a direção escolhida.",
    busy: true,
    yourTurn: false,
  },
  in_review: {
    label: "Dando uma última olhada",
    text: "Uma pessoa da nossa equipe confere o site antes de mostrar para você.",
    busy: true,
    yourTurn: false,
  },
  awaiting_approval: {
    label: "Site pronto para conferir",
    text: "Confira o site. Peça ajustes ou aprove para colocar no ar.",
    busy: false,
    yourTurn: true,
  },
  publishing: {
    label: "Colocando no ar",
    text: "Pagamento recebido. Estamos colocando o site no ar.",
    busy: true,
    yourTurn: false,
  },
  live: { label: "No ar", text: "Seu site está no ar.", busy: false, yourTurn: false },
  needs_attention: {
    label: "Precisa de atenção",
    text: "Algo precisa ser resolvido antes de seguir.",
    busy: false,
    yourTurn: false,
  },
  suspended: {
    label: "Suspenso",
    text: "Seu site foi suspenso. Veja os motivos na página do site.",
    busy: false,
    yourTurn: false,
  },
  grace: {
    label: "Renovação pendente",
    text: "A hospedagem venceu. Renove ou baixe o site antes que ele saia do ar.",
    busy: false,
    yourTurn: true,
  },
  generating: { label: "Gerando", text: "Montando o seu site.", busy: true, yourTurn: false },
  failed: {
    label: "Precisa de atenção",
    text: "Não conseguimos gerar este site. Fale com a gente.",
    busy: false,
    yourTurn: false,
  },
};

export function infoFor(status: string): StatusInfo {
  return statusInfo[status as SiteStatus] ?? statusInfo.draft;
}

/** Statuses where the client may still change answers that shape the design. */
export const designOpen: readonly string[] = [
  "draft",
  "awaiting_direction_choice",
  "needs_attention",
];
