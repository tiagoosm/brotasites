import type { Family } from "./taxonomy.js";

// Writing tips for the form (E41). Most clients write little, and the AI may only use what they
// wrote, so the form asks for concrete details: what they sell by name, what clients praise, how
// it started. Data here, not in the components. Every example is a client's own words: none
// claims a price, a number or an award. User-facing (pt-BR).

export interface WritingTip {
  /** A thin answer, the kind most people give. */
  weak: string;
  /** The same business told with details. */
  good: string;
  /** Two questions that lead to the details this family's sites use most. */
  questions: readonly [string, string];
}

export const writingTips: Record<Family, WritingTip> = {
  food: {
    weak: "Padaria com pães e bolos.",
    good: "Padaria de bairro desde 1998. Pão de fermentação natural todo dia de manhã, bolo de fubá da receita da avó e encomendas para festas.",
    questions: ["Qual é o produto mais pedido?", "Desde quando vocês estão no bairro?"],
  },
  beauty: {
    weak: "Salão de beleza com cortes e coloração.",
    good: "Salão no centro, com três cabeleireiras. Corte, coloração e tratamento para cabelo cacheado, com horário marcado pelo WhatsApp.",
    questions: ["Qual serviço os clientes mais procuram?", "O que vocês fazem diferente?"],
  },
  health: {
    weak: "Consultório de fisioterapia.",
    good: "Fisioterapia ortopédica e pós-operatória, com atendimento individual de 50 minutos. Atendo no consultório e em domicílio na região.",
    questions: ["Quais tratamentos você oferece?", "Como é o atendimento do começo ao fim?"],
  },
  automotive: {
    weak: "Oficina mecânica.",
    good: "Oficina de família, com foco em suspensão e freios. Mostramos a peça trocada e explicamos o serviço antes de começar.",
    questions: [
      "Em que tipo de serviço vocês são especialistas?",
      "Como vocês tratam o cliente na oficina?",
    ],
  },
  "home-services": {
    weak: "Eletricista.",
    good: "Eletricista residencial em toda a zona norte. Troca de quadro, tomadas e chuveiros, com orçamento antes do serviço.",
    questions: ["Quais serviços você mais faz?", "Em quais bairros ou cidades você atende?"],
  },
  retail: {
    weak: "Loja de roupas.",
    good: "Loja de moda feminina com peças do P ao GG, escolhidas uma a uma. Novidades toda semana e entrega no bairro.",
    questions: ["O que as clientes mais compram?", "O que a sua loja tem que as outras não têm?"],
  },
  education: {
    weak: "Aulas de inglês.",
    good: "Aulas de inglês para adultos, em grupos pequenos ou individuais. Foco em conversação para viagem e trabalho.",
    questions: ["Para quem são as aulas?", "Como é uma aula com você?"],
  },
  professionals: {
    weak: "Escritório de contabilidade.",
    good: "Contabilidade para pequenos negócios e MEI. Abertura de empresa, folha de pagamento e imposto de renda, com atendimento por WhatsApp.",
    questions: ["Que tipo de cliente você mais atende?", "Quais serviços você oferece?"],
  },
  "events-creative": {
    weak: "Fotógrafo de eventos.",
    good: "Fotografia de casamentos e aniversários com luz natural. Entrego as fotos tratadas em uma galeria online para os convidados.",
    questions: ["Que tipo de evento você mais faz?", "Como é o seu jeito de trabalhar no dia?"],
  },
  "pet-agro-institutions": {
    weak: "Pet shop.",
    good: "Pet shop com banho e tosa com hora marcada, ração a granel e busca e entrega do pet no bairro.",
    questions: ["Qual serviço é o mais procurado?", "O que os clientes mais elogiam?"],
  },
};

/** Hints under each story question: what kind of detail it asks for. */
export const storyHints = {
  origin: "Ex.: quem abriu, quando e por quê.",
  unique: "Ex.: uma receita, um serviço ou um jeito de atender que é só seu.",
  praise: "Ex.: o atendimento, um produto pelo nome, a pontualidade.",
  place: "Ex.: perto da praça, no centro, atende a região toda.",
  bestseller: "Ex.: o nome do produto ou do serviço campeão.",
} as const;

/** Under this many characters, the description gets a gentle nudge. */
export const DESCRIPTION_SHORT = 80;
/** From this many characters, the description is praised. */
export const DESCRIPTION_GOOD = 200;

/**
 * Whether the client gave little to write from (E41): a short description and no story answer.
 * The writer and the editor then write less on purpose, and the client is invited to tell more.
 */
export function fewFacts(business: {
  description?: string;
  story?: Partial<Record<string, string | undefined>>;
}): boolean {
  const description = (business.description ?? "").trim();
  const stories = Object.values(business.story ?? {}).filter((answer) => (answer ?? "").trim());
  return description.length < DESCRIPTION_SHORT && stories.length === 0;
}
