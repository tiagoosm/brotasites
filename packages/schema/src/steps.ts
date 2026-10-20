import { z } from "zod";

// Per-step validation for the form. Messages are user-facing (pt-BR): they say what to do.

export const businessStepSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escreva o nome do negócio, com pelo menos 2 letras.")
    .max(80, "Use até 80 caracteres."),
  category: z
    .string()
    .trim()
    .min(2, "Escolha um tipo da lista ou escreva qual é.")
    .max(60, "Use até 60 caracteres."),
  city: z
    .string()
    .trim()
    .min(2, "Escreva a cidade onde o negócio fica.")
    .max(60, "Use até 60 caracteres."),
});

export type BusinessStep = z.infer<typeof businessStepSchema>;

/**
 * The form steps, in order. The slogan promises seven questions, so each step is one:
 * `title` is the short name for the steps rail, `question` heads the step itself.
 * Slugs are the pt-BR URLs under /criar. See docs/platform-copy.md.
 */
export const formSteps = [
  {
    slug: "negocio",
    title: "Seu negócio",
    question: "Qual é o seu negócio?",
    description: "Três respostas e o seu site já começa a aparecer na prévia.",
  },
  {
    slug: "modelo",
    title: "Modelo",
    question: "Qual estilo combina com você?",
    description: "Todos os modelos se ajustam ao celular. Dá para trocar quando quiser.",
  },
  {
    slug: "cores",
    title: "Cores e fontes",
    question: "Que cores e letras são a sua cara?",
    description:
      "Comece por uma paleta pronta ou escolha as suas cores. A gente avisa se algum texto ficar difícil de ler.",
  },
  {
    slug: "secoes",
    title: "Seções",
    question: "O que não pode faltar no seu site?",
    description: "Ligue, desligue e mude a ordem das partes do site.",
  },
  {
    slug: "conteudo",
    title: "Conteúdo",
    question: "O que você quer contar?",
    description: "Escreva do jeito que você explicaria para um cliente.",
  },
  {
    slug: "contato",
    title: "Contato e fotos",
    question: "Como os clientes chegam até você?",
    description:
      "WhatsApp, endereço, horários e fotos aparecem no site exatamente como você informar.",
  },
  {
    slug: "endereco",
    title: "Endereço e revisão",
    question: "Onde o seu site vai morar?",
    description: "Escolha o endereço e confira tudo antes de publicar.",
  },
] as const;

export type FormStepSlug = (typeof formSteps)[number]["slug"];
