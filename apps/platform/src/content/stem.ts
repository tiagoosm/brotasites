import type { FormStepSlug12 } from "@brotasites/schema/v1.2";

// What each of the seven questions solves, in one sentence, for the home page stem.
// The questions themselves come from `formSteps12`, so they always match the form.

export const stemNotes: Record<FormStepSlug12, string> = {
  negocio: "Nome, tipo, cidade e sua história.",
  marca: "Logo, cores e o clima do site. Sem logo, criamos um monograma.",
  secoes: "Já vem o essencial ligado. Ajuste o resto.",
  conteudo: "Escreva do seu jeito: a gente arruma o texto.",
  contato: "WhatsApp, telefone, endereço e horários.",
  direcao: "Receba 3 direções e escolha uma.",
  endereco: "Confira, aprove e publique.",
};
