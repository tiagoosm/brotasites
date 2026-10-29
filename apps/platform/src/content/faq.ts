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
          "Não. Se você manda mensagem no WhatsApp, consegue criar o seu site. São sete perguntas, uma por tela. Depois, você escolhe uma de 3 direções para o visual e confere o site pronto antes de publicar.",
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
          "Sim, mas é rápido: antes da primeira pergunta você cria a conta com nome, e-mail e senha, e confirma o e-mail pelo link que enviamos. Depois, pode entrar com a senha ou com um link no e-mail. Assim as respostas, as fotos e os seus sites ficam guardados na sua conta.",
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
          "Pode. Use o caminho das perguntas ao lado do formulário ou o botão Voltar. Depois de escolher a direção, textos, fotos, contato e seções ainda mudam; cores e estilo ficam como você aprovou.",
      },
      {
        slug: "sem-fotos",
        question: "E se eu não tiver fotos agora?",
        answer:
          "O site fica bonito mesmo sem fotos. Você pode enviar as suas a qualquer momento antes de publicar.",
        main: true,
      },
      {
        slug: "o-que-sao-as-direcoes",
        question: "O que são as 3 direções?",
        answer:
          "São 3 caminhos para o visual do site, criados com as suas respostas: Fiel à marca, Evolução e Contraste. Você escolhe um, ou pede outros 3, quantas vezes quiser. Não precisa esperar com a página aberta: elas aparecem no seu painel quando ficam prontas.",
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
          "Só você. Ele fica na sua conta, e só a sua conta tem acesso a ele. O site pronto fica num endereço particular, que não aparece no Google, até você publicar.",
      },
      {
        slug: "apagar-conta",
        question: "Como apago a minha conta?",
        answer:
          "Na página Conta, em Excluir minha conta. Por segurança, pedimos que você entre de novo e escreva o seu e-mail para confirmar. A conta, os sites, os rascunhos e as fotos são apagados e os sites publicados saem do ar. Antes, se quiser, baixe uma cópia dos seus dados na mesma página.",
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
        answer: `Criar, editar, ver as direções e o site pronto é grátis. Para publicar, você paga ${launchNote} uma vez só, com ${pricing.hostingMonths} meses de hospedagem, ajustes pelo painel nos primeiros ${pricing.adjustmentsDays} dias e o direito de baixar o site quando quiser. Depois de ${pricing.hostingMonths} meses, manter no ar custa ${formatBRL(pricing.renewalPerYear)} por ano, se você quiser.`,
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
