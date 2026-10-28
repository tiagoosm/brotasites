import { type Facts, facts, slug } from "@brotasites/ai/evals";
import type { FormDraft, PhotoAnswer } from "@brotasites/schema/v1.2";

// The businesses of the blind test (docs/blind-test.md): 10 of the 30 fictional businesses of the
// evaluation set, across the three families of this round. Each one becomes a pair: the site
// BrotaSites makes from the form answers, and one a designer makes by hand from the same brief.

export const KIT_BUSINESSES = [
  "Padaria do Zé",
  "Café Grão Mineiro",
  "Pizzaria Forno a Lenha",
  "Marmitas da Cida",
  "Studio Bella",
  "Barbearia do Tonho",
  "Clínica Pele Leve",
  "Buffet Alegria",
  "Clique Eterno Fotografia",
  "Chalés Vale Verde",
] as const;

export interface KitBusiness {
  slug: string;
  facts: Facts;
}

export function kitBusinesses(names: readonly string[] = KIT_BUSINESSES): KitBusiness[] {
  return names.map((name) => {
    const item = facts.find((business) => business.name === name);
    if (!item) throw new Error(`Unknown business: ${name}`);
    return { slug: slug(item.name), facts: item };
  });
}

const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof days)[number];

/** The form answers a client would save for the business, as the platform stores them. */
export function draftOf(item: Facts, photos: PhotoAnswer[] = []): FormDraft {
  const openingHours =
    item.hours === "appointment" || item.hours === undefined
      ? { mode: "byAppointment" as const, rules: [] }
      : {
          mode: "schedule" as const,
          rules: item.hours.map(([list, open, close]) => ({
            days: list.filter((day): day is Day => (days as readonly string[]).includes(day)),
            intervals: [{ open, close }],
          })),
        };
  return {
    business: {
      name: item.name,
      category: item.category,
      city: item.city,
      state: item.state as NonNullable<FormDraft["business"]>["state"],
      description: item.description,
      foundedYear: item.foundedYear,
    },
    brand: { logoAsset: null, brandColors: item.brandColors ?? [], feelings: item.feelings ?? [] },
    content: {
      services: item.services.map(([name, description, price]) => ({ name, description, price })),
      highlights: [],
      faq: (item.faq ?? []).map(([question, answer]) => ({ question, answer })),
      testimonials: [],
      photos,
    },
    contact: {
      whatsapp: item.whatsapp,
      phone: item.phone,
      email: item.email,
      hasFixedAddress: Boolean(item.street),
      street: item.street,
      number: item.number,
      district: item.district,
      serviceArea: item.serviceArea ?? [],
      openingHours,
    },
    site: { subdomain: slug(item.name) },
  };
}

const dayNames: Record<Day, string> = {
  mon: "segunda",
  tue: "terça",
  wed: "quarta",
  thu: "quinta",
  fri: "sexta",
  sat: "sábado",
  sun: "domingo",
};

function phone(digits: string): string {
  const local = digits.replace(/^55/, "");
  const area = local.slice(0, 2);
  const rest = local.slice(2);
  return `(${area}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
}

/**
 * The brief the designer gets for the hand-made version (pt-BR): the same answers BrotaSites
 * receives, nothing more, and the rules both versions follow.
 */
export function briefOf(business: KitBusiness, photoFiles: string[] = []): string {
  const item = business.facts;
  const lines: string[] = [
    `# ${item.name}`,
    "",
    `Pasta da entrega: \`hand/${business.slug}/\` (com um \`index.html\`).`,
    "",
    "## O negócio",
    "",
    `- Tipo: ${item.category.replaceAll("-", " ")}`,
    `- Cidade: ${item.city} (${item.state})`,
  ];
  if (item.street) {
    lines.push(
      `- Endereço: ${item.street}, ${item.number ?? "s/n"}${item.district ? `, ${item.district}` : ""}`,
    );
  }
  if (item.serviceArea?.length) lines.push(`- Atende: ${item.serviceArea.join(", ")}`);
  if (item.foundedYear) lines.push(`- Desde: ${item.foundedYear}`);
  lines.push(`- Descrição (do dono): ${item.description}`);
  if (item.feelings?.length)
    lines.push(`- Sensação que o site deve passar: ${item.feelings.join(", ")}`);
  if (item.brandColors?.length) lines.push(`- Cores da marca: ${item.brandColors.join(", ")}`);
  lines.push("", "## Serviços", "");
  for (const [name, description, price] of item.services) {
    lines.push(`- ${name}${description ? `: ${description}` : ""}${price ? ` (${price})` : ""}`);
  }
  if (item.faq?.length) {
    lines.push("", "## Perguntas frequentes", "");
    for (const [question, answer] of item.faq) lines.push(`- ${question} ${answer}`);
  }
  lines.push("", "## Contato e horário", "");
  if (item.whatsapp) lines.push(`- WhatsApp: ${phone(item.whatsapp)}`);
  if (item.phone) lines.push(`- Telefone: ${phone(item.phone)}`);
  if (item.email) lines.push(`- E-mail: ${item.email}`);
  if (item.hours === "appointment" || item.hours === undefined) {
    lines.push("- Horário: com hora marcada");
  } else {
    for (const [list, open, close] of item.hours) {
      const names = list.map((day) => dayNames[day as Day] ?? day).join(", ");
      lines.push(`- ${names}: ${open} às ${close}`);
    }
  }
  lines.push(
    "",
    "## Fotos",
    "",
    photoFiles.length
      ? `Use só estas fotos (as mesmas da versão gerada): ${photoFiles.join(", ")}.`
      : "Sem fotos: a versão gerada também não tem nenhuma.",
    "",
    "## Regras (iguais para as duas versões)",
    "",
    "- Uma página só, em português, com conteúdo tirado só deste resumo.",
    "- Não invente depoimentos, números, prêmios ou contatos.",
    "- Sem formulário de contato, sem mapa embutido (só um botão “Como chegar”), sem cookies.",
    "- Sem pedidos a outros endereços: fontes, imagens e scripts dentro da pasta.",
    "- Links e arquivos com caminhos relativos (`img/foto.jpg`, não `/img/foto.jpg`).",
    "- Nenhuma assinatura, crédito ou nome de ferramenta na página nem no código.",
    "",
  );
  return lines.join("\n");
}
