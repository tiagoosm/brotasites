import type { FormStepSlug } from "@brotasites/schema";

// What each of the seven questions solves, in one sentence, for the home page stem.
// The questions themselves come from `formSteps`, so they always match the form.

export const stemNotes: Record<FormStepSlug, string> = {
  negocio: "Nome, tipo e cidade. Com isso sugerimos o modelo, as cores e as partes do site.",
  modelo: "Escolha o estilo do site. Todos se ajustam ao celular.",
  cores:
    "Paletas pensadas para o seu tipo de negócio, ou as suas próprias cores. Avisamos se algum texto ficar difícil de ler.",
  secoes: "Ligue, desligue e mude a ordem: sobre, serviços, galeria, perguntas e contato.",
  conteudo: "Escreva do seu jeito. Enquanto um campo está em branco, a prévia mostra um exemplo.",
  contato:
    "WhatsApp, endereço, horários e fotos. Com os horários, o site mostra se você está aberto agora.",
  endereco: "Escolha o endereço, confira tudo e publique quando gostar.",
};
