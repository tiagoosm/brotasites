import type { FormStepSlug12 } from "@brotasites/schema/v1.2";

// What each of the seven questions solves, in one sentence, for the home page stem.
// The questions themselves come from `formSteps12`, so they always match the form.

export const stemNotes: Record<FormStepSlug12, string> = {
  negocio: "Nome, tipo e cidade, e um pouco da sua história. É dela que sai o texto do site.",
  marca:
    "Logo e cores, se você tiver, e a sensação que o site deve passar. Sem logo, criamos um monograma.",
  secoes:
    "Já vem ligado o que mais funciona para o seu tipo de negócio. Ligue ou desligue o resto.",
  conteudo:
    "Serviços, diferenciais, perguntas e fotos. Escreva do seu jeito: a gente arruma o texto.",
  contato:
    "WhatsApp, telefone, endereço e horários. Com os horários, o site mostra se você está aberto agora.",
  direcao:
    "Envie e pode fechar a página. Criamos 3 direções para o visual; você escolhe uma ou pede outras.",
  endereco:
    "Escolha o endereço, confira o site pronto e aprove. Ele vai para o ar depois do pagamento.",
};
