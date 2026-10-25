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
        answer:
          "Não. Se você manda mensagem no WhatsApp, consegue criar o seu site. São sete perguntas, uma por tela, e a prévia mostra o resultado enquanto você responde.",
        main: true,
      },
      {
        slug: "quanto-tempo-leva",
        question: "Quanto tempo leva?",
        answer:
          "Depende de quanto você quer escrever. Dá para responder tudo de uma vez ou aos poucos: as respostas ficam salvas e você continua de onde parou.",
      },
      {
        slug: "preciso-de-conta",
        question: "Preciso criar uma conta?",
        answer:
          "Para começar, não. As respostas ficam salvas neste aparelho. Para guardar na sua conta, enviar fotos e publicar, você entra com o seu e-mail: mandamos um link de acesso, sem senha.",
      },
    ],
  },
  {
    slug: "as-sete-perguntas",
    title: "As sete perguntas",
    items: [
      {
        slug: "posso-voltar-e-mudar",
        question: "Posso voltar e mudar uma resposta?",
        answer:
          "Pode. Use o caminho das perguntas ao lado do formulário ou o botão Voltar. A prévia acompanha cada mudança.",
      },
      {
        slug: "sem-fotos",
        question: "E se eu não tiver fotos agora?",
        answer:
          "O site fica bonito mesmo sem fotos. Você pode enviar as suas a qualquer momento antes de publicar.",
        main: true,
      },
      {
        slug: "o-que-e-a-previa",
        question: "O que é a prévia?",
        answer:
          "É o seu site de verdade, montado com as suas respostas. No computador ela fica ao lado do formulário; no celular, abre no botão de prévia.",
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
          "Não. Preços, horários, endereço, contatos e depoimentos vêm só do que você informar. A seção de depoimentos só aparece se você cadastrar opiniões reais.",
        main: true,
      },
      {
        slug: "quem-ve-o-rascunho",
        question: "Quem vê o meu rascunho?",
        answer:
          "Só você. Antes de entrar, ele fica guardado neste aparelho. Depois de entrar, fica na sua conta, e só a sua conta tem acesso a ele.",
      },
      {
        slug: "apagar-conta",
        question: "Como apago a minha conta?",
        answer:
          "Ainda não há um botão para isso. Por enquanto, a exclusão da conta e dos seus dados é feita a pedido, pelo contato que aparece no fim desta página.",
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
        answer: `Criar, editar e ver a prévia é grátis. Para publicar, você paga ${launchNote} uma vez só, com ${pricing.hostingMonths} meses de hospedagem, ajustes pelo painel nos primeiros ${pricing.adjustmentsDays} dias e o direito de baixar o site quando quiser. Depois de ${pricing.hostingMonths} meses, manter no ar custa ${formatBRL(pricing.renewalPerYear)} por ano, se você quiser.`,
        main: true,
      },
      {
        slug: "endereco-do-site",
        question: "Qual vai ser o endereço do meu site?",
        answer: `Você escolhe na última pergunta, no formato seu-negocio.brotasites.com. Se quiser um domínio próprio, como seunegocio.com.br, conectar custa + ${formatBRL(pricing.customDomain)}: você registra o domínio e paga o registro direto ao registrador.`,
      },
      {
        slug: "mudar-depois",
        question: "Posso mudar o site depois de publicar?",
        answer: `Pode. Nos primeiros ${pricing.adjustmentsDays} dias depois de publicar, os ajustes pelo painel estão incluídos. Depois disso, você pode pedir ajustes à parte, com o valor informado antes.`,
      },
      {
        slug: "nao-quiser-mais",
        question: "E se eu não quiser mais?",
        answer: `O site é seu: você pode baixar o site pronto a qualquer momento e hospedá-lo onde quiser. Se não renovar depois dos ${pricing.hostingMonths} meses, ele sai do ar, e você pode baixá-lo antes. Nos primeiros ${pricing.guaranteeDays} dias depois de pagar, se não gostar, devolvemos o valor${legalNote}.`,
      },
    ],
  },
];

export const mainFaqs = faqGroups.flatMap((group) => group.items.filter((item) => item.main));
