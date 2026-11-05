import type { FormStepSlug12 } from "@brotasites/schema/v1.2";

// What each of the 5 steps solves, in one sentence, for the home page stem. The steps
// themselves come from `formSteps12`, so they always match the form. After them come two
// closings without a number: choosing one of the 3 looks, and the site live (E25).

export const stemNotes: Record<FormStepSlug12, string> = {
  negocio: "Nome, tipo, cidade e sua história.",
  marca: "Logo, cores e o clima do site. Sem logo, criamos um monograma.",
  secoes: "Já vem o essencial ligado. Ajuste o resto.",
  conteudo: "Escreva do seu jeito: a gente arruma o texto.",
  contato: "WhatsApp, telefone, endereço e horários. Depois, é só enviar.",
};

/** The first closing of the stem: not a step, the choice that comes after them. */
export const stemChoice = {
  title: "Escolha entre 3 visuais",
  note: "Receba 3 propostas feitas com as suas respostas e escolha uma. Depois, confira, aprove e publique.",
} as const;
