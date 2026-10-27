// Families and categories of schema 1.2 (docs/categories.md). The category a client picks only
// selects the family and tunes the vocabulary; the family drives the default sections, the
// default call to action and how strictly the site is reviewed. Labels are product copy (pt-BR).
// Blocked categories are not here: the form refuses them before a category is ever set.

export const families = [
  "food",
  "beauty",
  "health",
  "automotive",
  "home-services",
  "retail",
  "education",
  "professionals",
  "events-creative",
  "pet-agro-institutions",
] as const;
export type Family = (typeof families)[number];

/** Section ids of schema 1.2, in the order a site shows them. */
export const sectionIds = [
  "hero",
  "sobre",
  "servicos",
  "como-funciona",
  "diferenciais",
  "galeria",
  "depoimentos",
  "faq",
  "cta-final",
  "contato",
] as const;
export type SectionId = (typeof sectionIds)[number];

/**
 * How a site is reviewed before publishing: `standard` follows the general rule (human review
 * at first), `reinforced` never publishes without human review, `mandatory` also needs the
 * professional registration.
 */
export type ReviewLevel = "standard" | "reinforced" | "mandatory";

/** Launch wave: 1 opens first; 3 only after legal validation. */
export type LaunchWave = 1 | 2 | 3;

export interface FamilyInfo {
  label: string;
  defaultCta: string;
  defaultSections: readonly SectionId[];
  requiresRegistration: boolean;
}

export const familyInfo: Record<Family, FamilyInfo> = {
  food: {
    label: "Alimentação",
    defaultCta: "Pedir pelo WhatsApp",
    defaultSections: ["hero", "servicos", "galeria", "contato"],
    requiresRegistration: false,
  },
  beauty: {
    label: "Beleza e bem-estar",
    defaultCta: "Marcar horário",
    defaultSections: ["hero", "servicos", "galeria", "sobre", "contato"],
    requiresRegistration: false,
  },
  health: {
    label: "Saúde regulada",
    defaultCta: "Agendar contato",
    defaultSections: ["hero", "servicos", "sobre", "contato"],
    requiresRegistration: true,
  },
  automotive: {
    label: "Automotivo",
    defaultCta: "Pedir orçamento",
    defaultSections: ["hero", "servicos", "galeria", "contato"],
    requiresRegistration: false,
  },
  "home-services": {
    label: "Casa e serviços técnicos",
    defaultCta: "Pedir orçamento",
    defaultSections: ["hero", "servicos", "como-funciona", "galeria", "contato"],
    requiresRegistration: false,
  },
  retail: {
    label: "Comércio local",
    defaultCta: "Falar com a loja",
    defaultSections: ["hero", "diferenciais", "sobre", "contato"],
    requiresRegistration: false,
  },
  education: {
    label: "Educação e aulas",
    defaultCta: "Aula experimental",
    defaultSections: ["hero", "servicos", "sobre", "contato"],
    requiresRegistration: false,
  },
  professionals: {
    label: "Profissionais liberais",
    defaultCta: "Falar com o profissional",
    defaultSections: ["hero", "servicos", "sobre", "faq", "contato"],
    requiresRegistration: false,
  },
  "events-creative": {
    label: "Eventos e criativos",
    defaultCta: "Pedir orçamento",
    defaultSections: ["hero", "galeria", "servicos", "sobre", "contato"],
    requiresRegistration: false,
  },
  "pet-agro-institutions": {
    label: "Pet, agro e instituições",
    defaultCta: "Falar pelo WhatsApp",
    defaultSections: ["hero", "servicos", "galeria", "contato"],
    requiresRegistration: false,
  },
};

export interface CategoryInfo {
  id: string;
  label: string;
  family: Family;
  review: ReviewLevel;
  wave: LaunchWave;
}

// [id, label, review] per family; the wave follows from the family and the review level.
type Row = [id: string, label: string, review?: ReviewLevel];

const rows: Record<Family, Row[]> = {
  food: [
    ["padaria", "Padaria"],
    ["confeitaria", "Confeitaria e bolos por encomenda"],
    ["doces-encomenda", "Doces por encomenda"],
    ["marmitaria", "Marmitaria"],
    ["cafeteria", "Cafeteria"],
    ["acai-sorveteria", "Açaí e sorveteria"],
    ["food-truck", "Food truck"],
    ["lanchonete", "Lanchonete e hamburgueria"],
    ["pizzaria", "Pizzaria"],
    ["restaurante", "Restaurante e self-service"],
    ["hortifruti-acougue", "Hortifrúti e açougue"],
  ],
  beauty: [
    ["salao-beleza", "Salão de beleza"],
    ["barbearia", "Barbearia"],
    ["manicure", "Manicure e pedicure"],
    ["sobrancelha-cilios", "Sobrancelha e cílios"],
    ["maquiadora", "Maquiadora"],
    ["estetica", "Estética facial e corporal"],
    ["massagem-spa", "Massagem e spa"],
    ["depilacao", "Depilação"],
    ["tatuagem-piercing", "Studio de tatuagem e piercing"],
  ],
  health: [
    ["dentista", "Dentista", "mandatory"],
    ["fisioterapia", "Fisioterapia", "mandatory"],
    ["psicologia", "Psicologia", "mandatory"],
    ["nutricao", "Nutrição", "mandatory"],
    ["fonoaudiologia", "Fonoaudiologia", "mandatory"],
    ["veterinario", "Veterinário", "mandatory"],
    ["clinica-medica", "Clínica médica pequena", "mandatory"],
    ["terapias-integrativas", "Terapias integrativas", "mandatory"],
    ["pilates-personal", "Pilates e personal trainer", "mandatory"],
  ],
  automotive: [
    ["oficina-mecanica", "Oficina mecânica"],
    ["funilaria-pintura", "Funilaria e pintura"],
    ["auto-eletrica", "Auto elétrica"],
    ["lava-jato", "Lava-jato e estética automotiva"],
    ["borracharia", "Borracharia e troca de óleo"],
    ["martelinho-polimento", "Martelinho de ouro e polimento"],
    ["som-insulfilme", "Som e insulfilme"],
    ["vidracaria-automotiva", "Vidraçaria automotiva"],
    ["oficina-moto", "Oficina de moto"],
    ["autoescola", "Autoescola"],
    ["autopecas", "Autopeças"],
    ["guincho", "Guincho", "reinforced"],
  ],
  "home-services": [
    ["eletricista", "Eletricista"],
    ["encanador", "Encanador"],
    ["pintor-reformas", "Pintor e reformas"],
    ["marcenaria", "Marcenaria"],
    ["serralheria-vidracaria", "Serralheria e vidraçaria"],
    ["ar-condicionado", "Ar-condicionado"],
    ["limpeza", "Limpeza"],
    ["jardinagem", "Jardinagem e paisagismo"],
    ["piscineiro", "Piscineiro"],
    ["assistencia-tecnica", "Assistência técnica"],
    ["dedetizacao", "Dedetização"],
    ["mudancas-fretes", "Mudanças e fretes", "reinforced"],
    ["chaveiro", "Chaveiro", "reinforced"],
    ["desentupidora", "Desentupidora", "reinforced"],
    ["energia-solar", "Energia solar"],
    ["cameras-seguranca", "Câmeras e segurança"],
  ],
  retail: [
    ["floricultura", "Floricultura"],
    ["presentes", "Presentes e personalizados"],
    ["papelaria", "Papelaria"],
    ["roupas", "Roupas e boutique"],
    ["calcados", "Calçados"],
    ["joalheria", "Joalheria e semijoias"],
    ["otica", "Ótica"],
    ["brecho", "Brechó"],
    ["moveis-decoracao", "Móveis e decoração"],
    ["material-construcao", "Material de construção"],
    ["celulares", "Celulares"],
    ["perfumaria", "Perfumaria"],
    ["livraria-sebo", "Livraria e sebo"],
    ["artigos-festa", "Artigos de festa"],
    ["adega", "Adega", "reinforced"],
  ],
  education: [
    ["reforco-escolar", "Reforço escolar"],
    ["idiomas", "Idiomas"],
    ["musica", "Música"],
    ["danca", "Dança"],
    ["artes-marciais", "Artes marciais"],
    ["escolinha-esportes", "Escolinha de esportes"],
    ["natacao", "Natação"],
    ["academia", "Academia pequena"],
    ["cursos-profissionalizantes", "Cursos profissionalizantes"],
    ["preparatorio", "Preparatório"],
    ["creche", "Creche e berçário"],
  ],
  professionals: [
    ["contador", "Contador"],
    ["arquiteto", "Arquiteto e interiores"],
    ["fotografo-videomaker", "Fotógrafo e videomaker"],
    ["despachante", "Despachante"],
    ["corretor-imoveis", "Corretor de imóveis"],
    ["corretor-seguros", "Corretor de seguros"],
    ["advogado", "Advogado", "reinforced"],
    ["engenheiro", "Engenheiro e técnico"],
    ["consultor-coach", "Consultor e coach", "reinforced"],
    ["tradutor", "Tradutor"],
    ["agencia-viagens", "Agência de viagens"],
    ["personal-organizer", "Personal organizer"],
    ["cuidadores", "Cuidadores", "reinforced"],
  ],
  "events-creative": [
    ["buffet-festas", "Buffet e festas infantis"],
    ["espaco-eventos", "Espaço de eventos"],
    ["dj-sonorizacao", "DJ e sonorização"],
    ["decoracao-cerimonial", "Decoração e cerimonial"],
    ["aluguel-festas", "Aluguel de mesas, cadeiras e brinquedos"],
    ["salgados-doces-festa", "Salgados e doces para festas"],
    ["fotografo-eventos", "Fotógrafo de eventos e newborn"],
    ["barman", "Barman"],
    ["artesanato-atelie", "Artesanato e ateliê"],
    ["estamparia", "Personalizados e estamparia"],
    ["oficinas", "Oficinas"],
    ["turismo-local", "Turismo local"],
    ["pousada-chale", "Pousada e chalé"],
  ],
  "pet-agro-institutions": [
    ["banho-tosa", "Banho e tosa"],
    ["pet-shop", "Pet shop"],
    ["hotel-creche-pet", "Hotel e creche pet"],
    ["adestrador-passeador", "Adestrador e passeador"],
    ["agropecuaria", "Agropecuária"],
    ["produtor-rural", "Produtor rural"],
    ["feiras", "Feiras"],
    ["igreja-templo", "Igreja e templo"],
    ["ong-associacao", "ONG e associações"],
  ],
};

const firstWave: ReadonlySet<Family> = new Set([
  "food",
  "beauty",
  "automotive",
  "home-services",
  "events-creative",
]);

function waveOf(family: Family, review: ReviewLevel): LaunchWave {
  if (review !== "standard") return 3;
  return firstWave.has(family) ? 1 : 2;
}

/** The "Outro" category: any family the reviewer assigns, always reviewed by a person. */
export const OTHER_CATEGORY = "outro";

export const categories: readonly CategoryInfo[] = families.flatMap((family) =>
  rows[family].map(([id, label, review = "standard"]) => ({
    id,
    label,
    family,
    review,
    wave: waveOf(family, review),
  })),
);

export const categoryIds: readonly string[] = [
  ...categories.map((category) => category.id),
  OTHER_CATEGORY,
];

const byId = new Map(categories.map((category) => [category.id, category]));

/** The category's data, or undefined for "outro" and unknown ids. */
export function categoryInfo(id: string): CategoryInfo | undefined {
  return byId.get(id);
}

/** Review level of a category; "outro" and unknown ids are always reviewed by a person. */
export function reviewLevel(id: string): ReviewLevel {
  return byId.get(id)?.review ?? "reinforced";
}
