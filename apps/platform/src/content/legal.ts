import { formatBRL, LEGAL_REVIEW_PENDING, pricing } from "@/config/pricing";
import { PENDING } from "./contact";

// Prices and conditions come from src/config/pricing.ts.
const publishPriceText =
  pricing.launchPrice === null
    ? formatBRL(pricing.publish)
    : `${formatBRL(pricing.launchPrice)} (preço de lançamento; o valor normal é ${formatBRL(pricing.publish)})`;

// Terms of use and privacy policy, in plain pt-BR. First drafts describing what the platform
// does today; they must be reviewed by a lawyer before BrotaSites accepts clients.

export type LegalBlock = string | { list: string[] };

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export const LEGAL_UPDATED = "29 de outubro de 2026";
// PENDING LEGAL REVIEW ("pendente de revisão jurídica"): a provisional text, version
// TERMS_VERSION ("2026-10-draft", src/lib/auth/schemas.ts and the accounts migration). Accounts
// record the version they accepted; a new version asks everyone to accept again.
export const LEGAL_NOTICE =
  "Versão inicial (2026-10-draft), pendente de revisão jurídica. O texto pode mudar antes do lançamento do serviço.";

export const privacySections: LegalSection[] = [
  {
    id: "quem-somos",
    title: "Quem cuida dos seus dados",
    blocks: [
      "O BrotaSites é uma plataforma, ainda em desenvolvimento, para criar o site de um negócio respondendo sete perguntas.",
      `Responsável pelo tratamento dos dados (controlador): ${PENDING}. Contato para assuntos de privacidade: ${PENDING}.`,
    ],
  },
  {
    id: "dados",
    title: "Quais dados coletamos",
    blocks: [
      {
        list: [
          "Seu nome, seu e-mail e sua senha, quando você cria a conta (a senha é guardada só de forma cifrada, ninguém consegue lê-la). O WhatsApp da conta é opcional.",
          "A data e a versão dos Termos e da Política de Privacidade que você aceitou.",
          "As respostas que você dá no formulário: nome, tipo e cidade do negócio, textos, endereço, telefone, WhatsApp, e-mail de contato do negócio, horários e redes sociais.",
          "As fotos que você envia.",
          "Os dados técnicos necessários para manter você conectado (a sessão de login) e para proteger as contas contra abuso: o endereço IP e o e-mail, guardados apenas de forma cifrada e por pouco tempo para limitar tentativas seguidas.",
        ],
      },
      "Não coletamos dados de pagamento. Não usamos cookies de publicidade nem de análise de audiência.",
    ],
  },
  {
    id: "uso",
    title: "Para que usamos",
    blocks: [
      {
        list: [
          "Criar as 3 direções para o visual e montar o seu site com as suas respostas.",
          "Guardar o seu rascunho na sua conta, para você continuar de qualquer aparelho.",
          "Enviar os e-mails da sua conta: confirmação do e-mail, link de acesso, redefinição de senha e troca de e-mail. Não enviamos outros e-mails.",
          "Proteger as contas contra robôs e tentativas de invasão.",
          "Gerar e publicar o seu site, quando você pedir.",
        ],
      },
      "Usamos esses dados para prestar o serviço que você pediu (Lei Geral de Proteção de Dados, art. 7º, V). Não vendemos seus dados.",
    ],
  },
  {
    id: "publico",
    title: "O que fica público",
    blocks: [
      "Enquanto você responde, o rascunho é só seu. O site pronto fica num endereço particular, que não aparece em buscadores, até você publicar. Quando você publica, o site fica aberto a qualquer pessoa na internet, com as informações e fotos que você escolheu colocar nele, como endereço, telefone e WhatsApp do negócio.",
    ],
  },
  {
    id: "onde",
    title: "Onde os dados ficam e com quem compartilhamos",
    blocks: [
      {
        list: [
          "Supabase: guarda as contas, os rascunhos e as fotos, em servidores em São Paulo.",
          "Anthropic (modelo de IA Claude): recebe as respostas que você escreve, sem a sua senha nem o seu e-mail, para organizar e revisar os textos do site e conferir o resultado.",
          "Trigger.dev: executa as tarefas que criam as direções e montam o site.",
          "Cloudflare: hospeda o site pronto para você conferir e, quando a publicação estiver disponível, os sites publicados. O Cloudflare Turnstile confere, nas telas de cadastro e de entrada, que quem usa é uma pessoa e não um robô.",
        ],
      },
      "Esses serviços tratam os dados apenas para fazer o BrotaSites funcionar. Alguns podem processar dados fora do Brasil, com as garantias exigidas pela lei.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies e dados no seu aparelho",
    blocks: [
      {
        list: [
          "Um cookie de sessão, para manter você conectado depois de entrar. Ele vale só para o endereço da plataforma, nunca para os sites dos clientes.",
          "Nas telas de cadastro e de entrada, o Cloudflare Turnstile pode usar dados do navegador para diferenciar pessoas de robôs.",
          "Uma cópia do rascunho no próprio navegador, para que nada se perca se a internet cair enquanto você responde.",
        ],
      },
      "Você pode apagar esses dados nas configurações do seu navegador. As respostas continuam guardadas na sua conta.",
    ],
  },
  {
    id: "prazo",
    title: "Por quanto tempo guardamos",
    blocks: [
      "Guardamos os dados da sua conta, os rascunhos e as fotos enquanto a conta existir. Você pode excluir a conta a qualquer momento, na página Conta: apagamos a conta, os sites, os rascunhos e as fotos, e tiramos do ar os sites publicados. Os registros de pagamentos feitos ficam guardados pelo prazo que a lei fiscal exige.",
    ],
  },
  {
    id: "direitos",
    title: "Seus direitos",
    blocks: [
      "Pela Lei Geral de Proteção de Dados (art. 18), você pode pedir a qualquer momento:",
      {
        list: [
          "a confirmação de que tratamos seus dados e o acesso a eles;",
          "a correção de dados incompletos ou desatualizados;",
          "a eliminação dos dados, incluindo a exclusão da conta;",
          "a portabilidade dos dados para outro serviço;",
          "a informação sobre com quem compartilhamos os dados.",
        ],
      },
      `Na página Conta você corrige seu nome e WhatsApp, troca o e-mail, baixa uma cópia dos seus dados e exclui a conta. Os outros pedidos são feitos pelo contato de privacidade (${PENDING}). Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).`,
    ],
  },
  {
    id: "seguranca",
    title: "Segurança",
    blocks: [
      "Toda a comunicação com o BrotaSites é criptografada (HTTPS). Cada conta só tem acesso aos próprios rascunhos e fotos, e essas regras são aplicadas no próprio banco de dados.",
    ],
  },
  {
    id: "mudancas",
    title: "Mudanças nesta política",
    blocks: [
      "Quando esta política mudar, a data no topo da página será atualizada. Mudanças importantes serão avisadas antes de entrarem em vigor.",
    ],
  },
];

export const termsSections: LegalSection[] = [
  {
    id: "sobre",
    title: "Sobre estes termos",
    blocks: [
      "Estes termos explicam as regras para usar o BrotaSites. Ao usar a plataforma, você concorda com eles.",
      `Responsável pelo serviço: ${PENDING}. Contato: ${PENDING}.`,
    ],
  },
  {
    id: "servico",
    title: "O serviço",
    blocks: [
      "O BrotaSites ajuda você a criar o site do seu negócio respondendo sete perguntas. Com as respostas, criamos 3 direções para o visual; você escolhe uma e confere o site pronto antes de publicar.",
      `Criar, editar, ver as direções e o site pronto é grátis. Publicar o site custa ${publishPriceText}, em pagamento único, e você só paga se decidir publicar.`,
      "O serviço está em desenvolvimento: funções podem mudar, ser incluídas ou retiradas.",
    ],
  },
  {
    id: "preco",
    title: "Preço, renovação e reembolso",
    blocks: [
      `Texto ${LEGAL_REVIEW_PENDING}.`,
      {
        list: [
          `O pagamento para publicar inclui ${pricing.hostingMonths} meses de hospedagem no endereço seunegocio.brotasites.com e ajustes pelo painel nos primeiros ${pricing.adjustmentsDays} dias. Depois desse prazo, ajustes podem ser pedidos à parte, com o valor informado antes.`,
          `O site é seu: você pode baixar o site pronto a qualquer momento e hospedá-lo onde quiser.`,
          `Depois dos ${pricing.hostingMonths} meses, manter o site no ar custa ${formatBRL(pricing.renewalPerYear)} por ano, de forma opcional. Se não houver renovação, o site sai do ar, e você pode baixá-lo antes.`,
          `Conectar um domínio próprio custa ${formatBRL(pricing.customDomain)}. O registro do domínio é feito e pago por você, direto ao registrador.`,
          `Garantia de ${pricing.guaranteeDays} dias: se não gostar, devolvemos o valor pago.`,
        ],
      },
    ],
  },
  {
    id: "conta",
    title: "Sua conta",
    blocks: [
      "Você cria a conta com seu nome, seu e-mail e uma senha, e confirma o e-mail pelo link que enviamos. Depois, entra com a senha ou com um link de acesso enviado ao e-mail. Use um e-mail que seja seu e cuide do acesso a ele e da sua senha, porque quem acessa o e-mail consegue entrar na conta.",
      "Você pode baixar seus dados e excluir a conta a qualquer momento, na página Conta.",
    ],
  },
  {
    id: "conteudo",
    title: "Seu conteúdo",
    blocks: [
      "Você é responsável pelas informações, textos e fotos que coloca no site. Ao enviar, você declara que as informações são verdadeiras e que tem o direito de usar as fotos.",
      "O conteúdo continua sendo seu. Você nos autoriza a guardá-lo, processá-lo e exibi-lo apenas para prestar o serviço: criar as direções, montar o site, guardar o rascunho e publicar o site quando você pedir.",
      "O BrotaSites não inventa informações sobre o seu negócio. Preços, horários, endereço, contatos e depoimentos vêm só do que você informar.",
    ],
  },
  {
    id: "proibido",
    title: "O que não é permitido",
    blocks: [
      {
        list: [
          "Publicar conteúdo ilegal, enganoso ou que viole direitos de outras pessoas, como fotos e marcas sem autorização.",
          "Usar o site para aplicar golpes ou enganar consumidores.",
          "Publicar conteúdo discriminatório, violento ou que incentive o ódio.",
          "Tentar acessar dados de outras contas ou atrapalhar o funcionamento da plataforma.",
        ],
      },
      "Podemos remover conteúdo ou suspender contas que descumpram estas regras.",
    ],
  },
  {
    id: "disponibilidade",
    title: "Disponibilidade",
    blocks: [
      "Trabalhamos para que o BrotaSites funcione sempre, mas, por estar em desenvolvimento, ele pode ficar fora do ar ou apresentar falhas. Recomendamos guardar uma cópia dos textos importantes.",
    ],
  },
  {
    id: "encerramento",
    title: "Encerramento",
    blocks: [
      "Você pode parar de usar o BrotaSites quando quiser e pedir a exclusão da sua conta. A exclusão também retira do ar os sites publicados pela conta.",
    ],
  },
  {
    id: "responsabilidade",
    title: "Responsabilidade",
    blocks: [
      "Respondemos pelo serviço na forma da lei. Nada nestes termos limita os direitos garantidos pelo Código de Defesa do Consumidor.",
    ],
  },
  {
    id: "lei",
    title: "Lei aplicável",
    blocks: ["Estes termos seguem as leis do Brasil."],
  },
];
