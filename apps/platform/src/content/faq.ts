// Questions and answers for /ajuda; the ones marked `main` also appear on the home page.
// Answers state only what the product does today (see docs/platform-copy.md).

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
        answer:
          "Criar o site e ver a prévia é grátis. O preço para publicar aparece antes de você publicar, e você só paga se quiser colocar o site no ar.",
        main: true,
      },
      {
        slug: "endereco-do-site",
        question: "Qual vai ser o endereço do meu site?",
        answer:
          "Você escolhe na última pergunta, no formato seu-negocio.brotasites.com. Domínio próprio, como seunegocio.com.br, ainda não está disponível.",
      },
      {
        slug: "mudar-depois",
        question: "Posso mudar o site depois de publicar?",
        answer:
          "Suas respostas continuam guardadas na sua conta. A forma de fazer ajustes depois de publicar ainda está sendo definida e será explicada antes de você publicar.",
      },
    ],
  },
];

export const mainFaqs = faqGroups.flatMap((group) => group.items.filter((item) => item.main));
