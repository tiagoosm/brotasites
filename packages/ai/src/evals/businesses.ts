import type { PhotoQuality } from "@brotasites/catalog";
import type { EngineInput } from "@brotasites/engine";
import type { Family, Feeling, SiteConfigInput } from "@brotasites/schema/v1.2";

// The fixed evaluation set (docs/ai-and-reviewer.md, Evaluations): 30 fictional businesses,
// 10 per family of this round, with the answers a client would give in the form. Same names,
// cities and looks as the engine's fixtures; every fact here is invented for the tests.

interface Facts {
  family: Family;
  category: string;
  name: string;
  city: string;
  state: string;
  district?: string;
  street?: string;
  number?: string;
  serviceArea?: string[];
  foundedYear?: number;
  tagline?: string;
  description: string;
  services: [name: string, description?: string, price?: string][];
  faq?: [question: string, answer: string][];
  feelings?: Feeling[];
  brandColors?: string[];
  hasLogo?: boolean;
  photos?: PhotoQuality;
  whatsapp?: string;
  phone?: string;
  email?: string;
  hours?: "appointment" | [days: string[], open: string, close: string][];
}

export const facts: Facts[] = [
  {
    family: "food",
    category: "padaria",
    name: "Padaria do Zé",
    city: "Santa Rita do Sapucaí",
    state: "MG",
    district: "Centro",
    street: "Rua das Flores",
    number: "123",
    foundedYear: 1998,
    tagline: "Pão quentinho todo dia",
    description:
      "Padaria de bairro com pães de fermentação natural, bolos por encomenda e café da manhã desde 1998.",
    services: [
      ["Pães artesanais", "Fermentação natural, feitos todas as manhãs."],
      ["Bolos e tortas", "Por encomenda, com 2 dias de antecedência."],
      ["Café da manhã", "Mesa servida de segunda a sábado."],
    ],
    faq: [
      ["Vocês fazem encomendas?", "Sim, bolos e tortas com 2 dias de antecedência pelo WhatsApp."],
    ],
    feelings: ["acolhedor"],
    brandColors: ["#B45309", "#78350F"],
    hasLogo: true,
    whatsapp: "5535999990000",
    hours: [
      [["mon", "tue", "wed", "thu", "fri"], "06:00", "19:00"],
      [["sat"], "06:00", "14:00"],
    ],
  },
  {
    family: "food",
    category: "confeitaria",
    name: "Doce Lar Confeitaria",
    city: "Pouso Alegre",
    state: "MG",
    district: "São Geraldo",
    street: "Rua Comendador José Garcia",
    number: "410",
    description:
      "Bolos de aniversário, doces finos e tortas feitos sob encomenda pela Marina, que aprendeu com a avó.",
    services: [
      ["Bolos de aniversário", "Massa amanteigada e recheio à escolha.", "R$ 95,00 o quilo"],
      ["Doces finos", "Brigadeiro gourmet, camafeu e bem-casado.", "R$ 180,00 o cento"],
      ["Tortas", "Torta holandesa e torta de limão."],
    ],
    faq: [
      [
        "Com quanto tempo preciso encomendar?",
        "Com pelo menos 5 dias para bolos e 7 dias para doces finos.",
      ],
    ],
    feelings: ["acolhedor", "elegante"],
    whatsapp: "5535988887777",
    hours: "appointment",
  },
  {
    family: "food",
    category: "marmitaria",
    name: "Marmitas da Cida",
    city: "Itajubá",
    state: "MG",
    district: "Varginha",
    street: "Avenida Cesário Alvim",
    number: "88",
    description:
      "Comida caseira em marmita, com cardápio que muda todo dia e entrega no horário do almoço.",
    services: [
      ["Marmita do dia", "Arroz, feijão, mistura e salada.", "R$ 22,00"],
      ["Marmita fitness", "Frango grelhado, legumes e arroz integral.", "R$ 26,00"],
    ],
    faq: [["Vocês entregam?", "Sim, entregamos no Centro e na Varginha entre 11h e 13h."]],
    photos: "weak",
    whatsapp: "5535977776666",
    hours: [[["mon", "tue", "wed", "thu", "fri", "sat"], "10:30", "14:00"]],
  },
  {
    family: "food",
    category: "cafeteria",
    name: "Café Grão Mineiro",
    city: "Varginha",
    state: "MG",
    district: "Centro",
    street: "Praça Matriz",
    number: "15",
    foundedYear: 2017,
    description:
      "Cafeteria com cafés especiais de produtores do Sul de Minas, métodos filtrados e pão de queijo assado na hora.",
    services: [
      ["Cafés especiais", "Grãos de fazendas do Sul de Minas, torra própria."],
      ["Métodos filtrados", "V60, Chemex e prensa francesa."],
      ["Pão de queijo", "Assado na hora."],
    ],
    feelings: ["elegante"],
    brandColors: ["#3F2A1E"],
    phone: "3532210000",
    whatsapp: "5535966665555",
    hours: [
      [["tue", "wed", "thu", "fri", "sat"], "08:00", "20:00"],
      [["sun"], "09:00", "13:00"],
    ],
  },
  {
    family: "food",
    category: "acai-sorveteria",
    name: "Açaí Tropical",
    city: "Campinas",
    state: "SP",
    district: "Barão Geraldo",
    street: "Avenida Albino J. B. de Oliveira",
    number: "1200",
    description:
      "Açaí batido na hora com mais de 20 acompanhamentos, e sorvetes de frutas brasileiras.",
    services: [
      ["Açaí no copo", "300 ml, 500 ml ou 700 ml.", "a partir de R$ 14,00"],
      ["Sorvete de frutas", "Cupuaçu, graviola, cajá e mangaba."],
    ],
    feelings: ["ousado"],
    brandColors: ["#6B21A8"],
    whatsapp: "5519955554444",
    hours: [[["mon", "tue", "wed", "thu", "fri", "sat", "sun"], "12:00", "22:00"]],
  },
  {
    family: "food",
    category: "food-truck",
    name: "Truck do Beto",
    city: "Belo Horizonte",
    state: "MG",
    serviceArea: ["Savassi", "Pampulha", "Feiras e eventos"],
    description:
      "Hambúrguer artesanal de blend da casa, feito na chapa, em feiras e eventos de BH.",
    services: [
      ["Hambúrguer clássico", "Blend de 160 g, queijo, alface e tomate.", "R$ 32,00"],
      ["Batata rústica", "Com alecrim e páprica.", "R$ 18,00"],
      ["Truck para eventos", "Atendemos casamentos e festas de empresa."],
    ],
    feelings: ["ousado", "moderno"],
    photos: "none",
    whatsapp: "5531944443333",
    hours: "appointment",
  },
  {
    family: "food",
    category: "lanchonete",
    name: "Lanche Bom",
    city: "Lavras",
    state: "MG",
    district: "Centro",
    street: "Rua Santana",
    number: "301",
    foundedYear: 2005,
    description: "Lanchonete de esquina com salgados fritos na hora, sanduíches e suco natural.",
    services: [
      ["Salgados", "Coxinha, kibe e pastel fritos na hora.", "R$ 7,00"],
      ["Sanduíches", "X-tudo, misto e bauru."],
      ["Sucos naturais", "Laranja, abacaxi com hortelã e maracujá."],
    ],
    feelings: ["robusto"],
    phone: "3538210000",
    hours: [[["mon", "tue", "wed", "thu", "fri", "sat"], "07:00", "22:00"]],
  },
  {
    family: "food",
    category: "pizzaria",
    name: "Pizzaria Forno a Lenha",
    city: "Poços de Caldas",
    state: "MG",
    district: "Centro",
    street: "Rua Assis Figueiredo",
    number: "520",
    description:
      "Pizza de massa de longa fermentação assada no forno a lenha, para comer no salão ou pedir em casa.",
    services: [
      ["Pizza tradicional", "Margherita, calabresa e portuguesa.", "a partir de R$ 59,00"],
      ["Pizza especial", "Parma com rúcula e quatro queijos."],
      ["Entrega", "Pedidos pelo WhatsApp."],
    ],
    faq: [["Fazem entrega?", "Sim, em Poços de Caldas, das 18h às 23h."]],
    brandColors: ["#DC2626", "#16A34A"],
    whatsapp: "5535933332222",
    hours: [[["tue", "wed", "thu", "fri", "sat", "sun"], "18:00", "23:00"]],
  },
  {
    family: "food",
    category: "restaurante",
    name: "Restaurante Sabor da Serra",
    city: "Monte Verde",
    state: "MG",
    district: "Centro",
    street: "Avenida Monte Verde",
    number: "700",
    foundedYear: 2010,
    description: "Comida mineira no fogão a lenha, com truta da região e sobremesas caseiras.",
    services: [
      ["Truta grelhada", "Com amêndoas e arroz com brócolis."],
      ["Feijão tropeiro", "Servido com torresmo e couve."],
      ["Doces caseiros", "Doce de leite e goiabada com queijo."],
    ],
    feelings: ["acolhedor"],
    photos: "weak",
    phone: "3534380000",
    whatsapp: "5535922221111",
    hours: [[["thu", "fri", "sat", "sun"], "12:00", "22:00"]],
  },
  {
    family: "food",
    category: "hortifruti-acougue",
    name: "Hortifruti Boa Safra",
    city: "Três Corações",
    state: "MG",
    district: "Jardim América",
    street: "Rua Joaquim Bento",
    number: "45",
    description:
      "Frutas, verduras e legumes que chegam do Ceasa toda manhã, com entrega no bairro.",
    services: [
      ["Frutas e verduras", "Chegam toda manhã."],
      ["Cestas da semana", "Montadas com o que está na safra.", "R$ 65,00"],
    ],
    feelings: ["moderno"],
    brandColors: ["#15803D"],
    whatsapp: "5535911110000",
    hours: [[["mon", "tue", "wed", "thu", "fri", "sat"], "07:00", "19:00"]],
  },
  {
    family: "beauty",
    category: "salao-beleza",
    name: "Studio Bella",
    city: "São Paulo",
    state: "SP",
    district: "Vila Mariana",
    street: "Rua Domingos de Morais",
    number: "2100",
    description: "Salão de beleza com corte, coloração e escova, com atendimento com hora marcada.",
    services: [
      ["Corte feminino", "Com lavagem e finalização.", "R$ 120,00"],
      ["Coloração", "Raiz ou global."],
      ["Escova", "Lisa ou modelada.", "R$ 60,00"],
    ],
    feelings: ["elegante"],
    brandColors: ["#BE185D"],
    whatsapp: "5511999998888",
    hours: [[["tue", "wed", "thu", "fri", "sat"], "09:00", "19:00"]],
  },
  {
    family: "beauty",
    category: "barbearia",
    name: "Barbearia do Tonho",
    city: "Curitiba",
    state: "PR",
    district: "Centro",
    street: "Rua XV de Novembro",
    number: "900",
    foundedYear: 2009,
    description: "Barbearia de três cadeiras com corte na tesoura, barba com toalha quente e café.",
    services: [
      ["Corte", "Tesoura ou máquina.", "R$ 45,00"],
      ["Barba", "Com toalha quente.", "R$ 35,00"],
      ["Corte e barba", undefined, "R$ 70,00"],
    ],
    feelings: ["robusto"],
    hasLogo: true,
    whatsapp: "5541988887777",
    hours: [[["tue", "wed", "thu", "fri", "sat"], "09:00", "20:00"]],
  },
  {
    family: "beauty",
    category: "manicure",
    name: "Unhas da Jé",
    city: "Pouso Alegre",
    state: "MG",
    serviceArea: ["Centro", "Faisqueira", "São Geraldo"],
    description: "Manicure e pedicure a domicílio, com material esterilizado em autoclave.",
    services: [
      ["Mão e pé", undefined, "R$ 55,00"],
      ["Esmaltação em gel", "Dura até 3 semanas."],
      ["Spa dos pés", "Esfoliação e hidratação."],
    ],
    feelings: ["acolhedor", "ousado"],
    photos: "none",
    whatsapp: "5535977775555",
    hours: "appointment",
  },
  {
    family: "beauty",
    category: "sobrancelha-cilios",
    name: "Olhar Design de Sobrancelhas",
    city: "Itajubá",
    state: "MG",
    district: "Centro",
    street: "Rua Coronel Rennó",
    number: "60",
    description:
      "Design de sobrancelhas com henna, brow lamination e extensão de cílios fio a fio.",
    services: [
      ["Design com henna", undefined, "R$ 50,00"],
      ["Brow lamination"],
      ["Extensão de cílios", "Fio a fio ou volume russo."],
    ],
    feelings: ["elegante", "moderno"],
    whatsapp: "5535966664444",
    hours: [[["mon", "tue", "wed", "thu", "fri"], "09:00", "18:00"]],
  },
  {
    family: "beauty",
    category: "maquiadora",
    name: "Make by Lia",
    city: "Rio de Janeiro",
    state: "RJ",
    serviceArea: ["Zona Sul", "Barra da Tijuca", "Niterói"],
    description: "Maquiagem para noivas, madrinhas e formaturas, no local do evento.",
    services: [
      ["Maquiagem de noiva", "Com teste antes do casamento."],
      ["Maquiagem social", "Para madrinhas, formandas e festas."],
    ],
    faq: [["Você vai até o local?", "Sim, na Zona Sul, na Barra da Tijuca e em Niterói."]],
    feelings: ["ousado"],
    whatsapp: "5521955553333",
    hours: "appointment",
  },
  {
    family: "beauty",
    category: "estetica",
    name: "Clínica Pele Leve",
    city: "Belo Horizonte",
    state: "MG",
    district: "Funcionários",
    street: "Rua Pernambuco",
    number: "1000",
    description:
      "Estética facial e corporal: limpeza de pele, drenagem linfática e massagem modeladora.",
    services: [
      ["Limpeza de pele", undefined, "R$ 150,00"],
      ["Drenagem linfática", "Sessões de 50 minutos."],
      ["Massagem modeladora"],
    ],
    brandColors: ["#0F766E"],
    phone: "3132220000",
    whatsapp: "5531944442222",
    email: "contato@peleleve.com.br",
    hours: [
      [["mon", "tue", "wed", "thu", "fri"], "08:00", "20:00"],
      [["sat"], "08:00", "12:00"],
    ],
  },
  {
    family: "beauty",
    category: "massagem-spa",
    name: "Spa Recanto",
    city: "Campos do Jordão",
    state: "SP",
    district: "Capivari",
    street: "Rua Djalma Forjaz",
    number: "100",
    description:
      "Spa com massagem relaxante, pedras quentes e banho de ofurô, em meio às araucárias.",
    services: [
      ["Massagem relaxante", "60 minutos.", "R$ 220,00"],
      ["Pedras quentes", "75 minutos."],
      ["Ofurô", "Banho de 30 minutos com sais."],
    ],
    feelings: ["acolhedor"],
    photos: "weak",
    whatsapp: "5512933331111",
    hours: [[["wed", "thu", "fri", "sat", "sun"], "10:00", "20:00"]],
  },
  {
    family: "beauty",
    category: "depilacao",
    name: "Depil Express",
    city: "Varginha",
    state: "MG",
    district: "Centro",
    street: "Avenida Rio Branco",
    number: "250",
    description: "Depilação com cera quente e fria, rápida e com horário marcado.",
    services: [
      ["Meia perna", undefined, "R$ 35,00"],
      ["Perna inteira", undefined, "R$ 60,00"],
      ["Axila", undefined, "R$ 20,00"],
    ],
    feelings: ["moderno"],
    whatsapp: "5535922220000",
    hours: [[["mon", "tue", "wed", "thu", "fri", "sat"], "09:00", "19:00"]],
  },
  {
    family: "beauty",
    category: "tatuagem-piercing",
    name: "Tinta Preta Tattoo",
    city: "Porto Alegre",
    state: "RS",
    district: "Cidade Baixa",
    street: "Rua da República",
    number: "500",
    foundedYear: 2014,
    description:
      "Estúdio de tatuagem fineline e blackwork, com agulhas descartáveis e orçamento pelo WhatsApp.",
    services: [["Tatuagem fineline"], ["Blackwork"], ["Piercing", "Joias de titânio."]],
    feelings: ["robusto", "ousado"],
    brandColors: ["#111111"],
    whatsapp: "5551911119999",
    hours: [[["tue", "wed", "thu", "fri", "sat"], "11:00", "20:00"]],
  },
  {
    family: "beauty",
    category: "barbearia",
    name: "Navalha de Ouro",
    city: "Santa Rita do Sapucaí",
    state: "MG",
    district: "Centro",
    street: "Avenida Delfim Moreira",
    number: "77",
    description: "Barbearia clássica com corte na navalha, pigmentação de barba e cerveja gelada.",
    services: [
      ["Corte na navalha", undefined, "R$ 40,00"],
      ["Pigmentação de barba"],
      ["Sobrancelha", undefined, "R$ 15,00"],
    ],
    feelings: ["elegante", "robusto"],
    brandColors: ["#CA8A04"],
    whatsapp: "5535999991111",
    hours: [[["mon", "tue", "wed", "thu", "fri", "sat"], "09:00", "21:00"]],
  },
  {
    family: "events-creative",
    category: "buffet-festas",
    name: "Buffet Alegria",
    city: "São Paulo",
    state: "SP",
    district: "Tatuapé",
    street: "Rua Tuiuti",
    number: "1500",
    description:
      "Buffet infantil com salão para até 120 convidados, monitores e cardápio de festa.",
    services: [
      ["Festa infantil", "Pacote de 4 horas com salão e monitores."],
      ["Cardápio de festa", "Salgados, mini pizzas, bolo e doces."],
    ],
    faq: [["Quantos convidados cabem?", "O salão recebe até 120 convidados."]],
    feelings: ["ousado"],
    phone: "1120900000",
    whatsapp: "5511988880000",
    hours: [[["tue", "wed", "thu", "fri"], "10:00", "18:00"]],
  },
  {
    family: "events-creative",
    category: "espaco-eventos",
    name: "Espaço Jardim das Flores",
    city: "Atibaia",
    state: "SP",
    district: "Jardim Itapetinga",
    street: "Estrada do Rosário",
    number: "3000",
    description: "Espaço para casamentos ao ar livre, com jardim, capela e salão para 200 pessoas.",
    services: [
      ["Casamentos", "Cerimônia no jardim ou na capela."],
      ["Salão", "Até 200 pessoas."],
      ["Visitas", "Agendadas pelo WhatsApp."],
    ],
    feelings: ["elegante"],
    brandColors: ["#166534"],
    whatsapp: "5511977770000",
    hours: "appointment",
  },
  {
    family: "events-creative",
    category: "dj-sonorizacao",
    name: "DJ Marquinhos",
    city: "Recife",
    state: "PE",
    serviceArea: ["Recife", "Olinda", "Jaboatão dos Guararapes"],
    description:
      "DJ para casamentos, aniversários e festas de empresa, com som e iluminação próprios.",
    services: [
      ["DJ para casamentos"],
      ["Som e iluminação", "Equipamento próprio."],
      ["Festas de empresa"],
    ],
    feelings: ["moderno", "ousado"],
    photos: "weak",
    whatsapp: "5581966660000",
    hours: "appointment",
  },
  {
    family: "events-creative",
    category: "decoracao-cerimonial",
    name: "Ateliê Laço de Fita",
    city: "Salvador",
    state: "BA",
    district: "Pituba",
    street: "Rua Ceará",
    number: "210",
    description: "Decoração de festas e cerimonial para aniversários, chás e batizados.",
    services: [
      ["Decoração de aniversário", "Painel, mesa e arranjos."],
      ["Cerimonial", "Organização no dia da festa."],
    ],
    feelings: ["acolhedor"],
    whatsapp: "5571955550000",
    hours: [[["mon", "tue", "wed", "thu", "fri"], "09:00", "18:00"]],
  },
  {
    family: "events-creative",
    category: "aluguel-festas",
    name: "Aluga Festa",
    city: "Goiânia",
    state: "GO",
    district: "Setor Bueno",
    street: "Avenida T-4",
    number: "800",
    description: "Aluguel de mesas, cadeiras, toalhas e louças para festas em Goiânia.",
    services: [
      ["Mesas e cadeiras", "Jogo com 4 cadeiras.", "R$ 12,00"],
      ["Toalhas", "Várias cores."],
      ["Louças e talheres"],
    ],
    photos: "none",
    whatsapp: "5562944440000",
    hours: [[["mon", "tue", "wed", "thu", "fri", "sat"], "08:00", "18:00"]],
  },
  {
    family: "events-creative",
    category: "salgados-doces-festa",
    name: "Salgadinhos da Vó Nena",
    city: "Fortaleza",
    state: "CE",
    serviceArea: ["Fortaleza"],
    description: "Salgadinhos fritos na hora e doces de festa por cento, com a receita da Vó Nena.",
    services: [
      ["Salgadinhos", "Coxinha, risole e bolinha de queijo.", "R$ 70,00 o cento"],
      ["Docinhos", "Brigadeiro e beijinho.", "R$ 80,00 o cento"],
    ],
    faq: [["Com quantos dias preciso encomendar?", "Com 3 dias de antecedência."]],
    feelings: ["acolhedor", "ousado"],
    hasLogo: true,
    whatsapp: "5585933330000",
    hours: [[["mon", "tue", "wed", "thu", "fri", "sat"], "08:00", "17:00"]],
  },
  {
    family: "events-creative",
    category: "fotografo-eventos",
    name: "Clique Eterno Fotografia",
    city: "Florianópolis",
    state: "SC",
    serviceArea: ["Florianópolis", "São José", "Palhoça"],
    description:
      "Fotografia de casamentos e ensaios de família, com entrega das fotos em galeria online.",
    services: [
      ["Casamentos", "Cobertura da cerimônia e da festa."],
      ["Ensaio de família", "Uma hora, ao ar livre."],
    ],
    feelings: ["elegante"],
    whatsapp: "5548922220000",
    hours: "appointment",
  },
  {
    family: "events-creative",
    category: "artesanato-atelie",
    name: "Ateliê Mãos de Barro",
    city: "Tiradentes",
    state: "MG",
    district: "Centro",
    street: "Rua Direita",
    number: "30",
    description: "Cerâmica feita à mão: canecas, pratos e vasos queimados no forno do ateliê.",
    services: [
      ["Canecas", undefined, "R$ 75,00"],
      ["Pratos e tigelas"],
      ["Oficina de cerâmica", "Aos sábados, para iniciantes."],
    ],
    feelings: ["acolhedor"],
    brandColors: ["#9A3412"],
    whatsapp: "5532911110000",
    hours: [[["thu", "fri", "sat", "sun"], "10:00", "18:00"]],
  },
  {
    family: "events-creative",
    category: "estamparia",
    name: "Estampa Viva",
    city: "Belém",
    state: "PA",
    district: "Nazaré",
    street: "Avenida Nazaré",
    number: "650",
    description:
      "Estamparia de camisetas, ecobags e uniformes em silk e sublimação, a partir de 10 peças.",
    services: [
      ["Camisetas personalizadas", "Silk ou sublimação."],
      ["Uniformes", "Para empresas e escolas."],
      ["Ecobags"],
    ],
    feelings: ["ousado", "moderno"],
    brandColors: ["#2563EB", "#F59E0B"],
    whatsapp: "5591988880000",
    email: "pedidos@estampaviva.com.br",
    hours: [[["mon", "tue", "wed", "thu", "fri"], "08:00", "18:00"]],
  },
  {
    family: "events-creative",
    category: "pousada-chale",
    name: "Chalés Vale Verde",
    city: "Gonçalves",
    state: "MG",
    district: "Bairro do Cruz",
    street: "Estrada Municipal",
    number: "5",
    description:
      "Chalés com lareira e banheira, café da manhã colonial e vista para a Serra da Mantiqueira.",
    services: [
      ["Chalé com lareira", "Para 2 pessoas."],
      ["Café da manhã colonial", "Servido no chalé."],
    ],
    faq: [["Aceitam pets?", "Não aceitamos animais."]],
    feelings: ["acolhedor", "elegante"],
    whatsapp: "5535944440000",
    hours: "appointment",
  },
];

const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-$/, "");
}

/** The form answers of a business as a 1.2 config before any generation. */
export function configOf(item: Facts): SiteConfigInput {
  const fixed = Boolean(item.street);
  const cta = item.whatsapp
    ? { label: "Chamar no WhatsApp", action: "whatsapp" as const }
    : { label: "Ligar", action: "phone" as const };
  const hours =
    item.hours === "appointment" || item.hours === undefined
      ? { mode: "byAppointment" as const, rules: [] }
      : {
          mode: "schedule" as const,
          rules: item.hours.map(([list, open, close]) => ({
            days: list.filter((day): day is (typeof days)[number] =>
              (days as readonly string[]).includes(day),
            ),
            intervals: [{ open, close }],
          })),
        };
  return {
    schemaVersion: "1.2",
    site: {
      type: "landing-page",
      language: "pt-BR",
      timezone: "America/Sao_Paulo",
      subdomain: slug(item.name),
      customDomain: null,
    },
    business: {
      name: item.name,
      tagline: item.tagline,
      category: item.category,
      family: item.family,
      description: item.description,
      foundedYear: item.foundedYear,
      contact: { whatsapp: item.whatsapp, phone: item.phone, email: item.email },
      address: {
        hasFixedAddress: fixed,
        street: item.street,
        number: item.number,
        district: item.district,
        city: item.city,
        state: item.state as SiteConfigInput["business"]["address"]["state"],
      },
      serviceArea: item.serviceArea ?? [],
      openingHours: hours,
      social: {},
    },
    brand: { logoAsset: null, brandColors: item.brandColors ?? [], feelings: item.feelings ?? [] },
    design: {
      seed: slug(`${item.name} ${item.city}`),
      round: 0,
      identity: null,
      directionStatus: "draft",
      approvedDirectionId: null,
      lockedFields: [],
      overrides: {},
    },
    sections: [
      {
        id: "hero",
        enabled: true,
        content: { title: item.tagline ?? item.name, image: null, cta },
      },
      {
        id: "sobre",
        enabled: true,
        content: { title: "Sobre", text: item.description, image: null },
      },
      {
        id: "servicos",
        enabled: true,
        content: {
          title: "Serviços",
          items: item.services.map(([name, description, price]) => ({ name, description, price })),
        },
      },
      ...(item.faq
        ? [
            {
              id: "faq" as const,
              enabled: true,
              content: {
                title: "Perguntas frequentes",
                items: item.faq.map(([question, answer]) => ({ question, answer })),
              },
            },
          ]
        : []),
      {
        id: "cta-final",
        enabled: true,
        content: { title: "Fale com a gente", cta },
      },
      {
        id: "contato",
        enabled: true,
        content: { title: "Contato", showHours: true, showMapLink: fixed },
      },
    ],
    navigation: { sticky: true, ctaLabel: cta.label },
    seo: { title: item.name, description: "", keywords: [] },
    integrations: { whatsappFloatingButton: Boolean(item.whatsapp) },
    ai: {
      tone: null,
      generatedFields: [],
      userEditedFields: [],
      promptVersion: null,
      playbookVersion: null,
      modelId: null,
    },
    review: { status: "notReviewed", reviewerReportId: null, humanDecision: null },
  };
}

export function engineInputOf(item: Facts, round = 0): EngineInput {
  return {
    name: item.name,
    city: item.city,
    category: item.category,
    family: item.family,
    feelings: item.feelings ?? [],
    brandColors: item.brandColors ?? [],
    hasLogo: item.hasLogo ?? false,
    photos: item.photos ?? "good",
    sections: [
      "hero",
      "sobre",
      "servicos",
      ...(item.faq ? (["faq"] as const) : []),
      "cta-final",
      "contato",
    ],
    round,
  };
}
