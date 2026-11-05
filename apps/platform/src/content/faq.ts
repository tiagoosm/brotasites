import { limits } from "@/config/limits";
import { formatBRL, LEGAL_REVIEW_PENDING, pricing } from "@/config/pricing";

// Questions and answers for /ajuda; the ones marked `main` also appear on the home page.
// Answers state only what the product does today (see docs/platform-copy.md).

// Prices and conditions come from src/config/pricing.ts.
const launchNote =
  pricing.launchPrice === null
    ? formatBRL(pricing.publish)
    : `${formatBRL(pricing.launchPrice)} (preço de lançamento; o normal é ${formatBRL(pricing.publish)})`;
const legalNote = pricing.legalReviewed ? "" : ` (texto ${LEGAL_REVIEW_PENDING})`;

export interface Faq {
  slug: string;
  question: string;
  answer: string;
  main?: boolean;
}

export interface FaqGroup {
  slug: string;
  title: string;
  items: Faq[];
}

export const faqGroups: FaqGroup[] = [
  {
    slug: "comecar",
    title: "Começar",
    items: [
      {
        slug: "preciso-entender-de-tecnologia",
        question: "Preciso entender de tecnologia?",
        answer: "Não. Se você usa WhatsApp, consegue. 5 passos, um por tela.",
        main: true,
      },
      {
        slug: "quanto-tempo-leva",
        question: "Quanto tempo leva?",
        answer: "Depende de você. Tudo fica salvo: continue de onde parou.",
      },
      {
        slug: "preciso-de-conta",
        question: "Preciso criar uma conta?",
        answer:
          "Sim: nome, e-mail e senha, e você confirma o e-mail. É onde suas respostas e sites ficam guardados.",
      },
    ],
  },
  {
    slug: "os-5-passos",
    title: "Os 5 passos",
    items: [
      {
        slug: "posso-voltar-e-mudar",
        question: "Posso voltar e mudar uma resposta?",
        answer:
          "Pode, a qualquer momento. Depois de escolher o visual, só cores e estilo ficam fixos.",
      },
      {
        slug: "sem-fotos",
        question: "E se eu não tiver fotos agora?",
        answer: "Sem problema. O site fica bonito sem fotos, e você envia depois.",
        main: true,
      },
      {
        slug: "o-que-sao-as-direcoes",
        question: "O que são as 3 direções?",
        answer: `3 propostas de visual feitas com as suas respostas: Fiel à marca, Evolução e Contraste. Escolha uma ou peça outras 3: são ${limits.freeDirectionRounds - 1} refazeres grátis, depois 1 por hora.`,
      },
    ],
  },
  {
    slug: "seus-dados",
    title: "Seus dados e informações",
    items: [
      {
        slug: "inventam-informacoes",
        question: "Vocês vão inventar informações sobre o meu negócio?",
        answer:
          "Não. Preços, horários, endereço, contatos e depoimentos vêm só das suas respostas.",
        main: true,
      },
      {
        slug: "quem-ve-o-rascunho",
        question: "Quem vê o meu rascunho?",
        answer: "Só você. Até publicar, o site fica num endereço particular, fora do Google.",
      },
      {
        slug: "apagar-conta",
        question: "Como apago a minha conta?",
        answer:
          "Em Conta, Excluir minha conta. Tudo é apagado e os sites saem do ar. Antes, se quiser, baixe uma cópia dos seus dados.",
      },
    ],
  },
  {
    slug: "preco-e-publicacao",
    title: "Preço e publicação",
    items: [
      {
        slug: "quanto-custa",
        question: "Quanto custa?",
        answer: `Criar é grátis. Publicar custa ${launchNote}, uma vez só, com ${pricing.hostingMonths} meses de hospedagem e ${pricing.adjustmentsDays} dias de ajustes. Depois, ${formatBRL(pricing.renewalPerYear)} por ano, se quiser renovar.`,
        main: true,
      },
      {
        slug: "endereco-do-site",
        question: "Qual vai ser o endereço do meu site?",
        answer: `seu-negocio.brotasites.com, escolhido na hora de publicar. Domínio próprio (seunegocio.com.br): incluído, se você quiser. O registro e a renovação do domínio são por sua conta, no registrador.`,
      },
      {
        slug: "mudar-depois",
        question: "Posso mudar o site depois de publicar?",
        answer: `Pode. Ajustes incluídos por ${pricing.adjustmentsDays} dias. Depois, à parte, com o valor informado antes.`,
      },
      {
        slug: "nao-quiser-mais",
        question: "E se eu não quiser mais?",
        answer: `O site é seu: baixe quando quiser. Sem renovar, ele sai do ar depois de ${pricing.hostingMonths} meses. Em até ${pricing.guaranteeDays} dias do pagamento, devolvemos o valor${legalNote}.`,
      },
    ],
  },
];

export const mainFaqs = faqGroups.flatMap((group) => group.items.filter((item) => item.main));
