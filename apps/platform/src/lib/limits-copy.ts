import { brasiliaTime, limits } from "@/config/limits";

// The pt-BR sentences about the limits (docs/platform-copy.md): short, calm, never alarming.

/** "Você usou 2 de 3 refazeres grátis." The first round is not a redo. */
export function redoUsage(used: number, free: number): string {
  const redosUsed = Math.max(0, used - 1);
  const redosFree = Math.max(0, free - 1);
  if (redosFree === 0) return "";
  return `Você usou ${Math.min(redosUsed, redosFree)} de ${redosFree} ${redosFree === 1 ? "refazer grátis" : "refazeres grátis"}.`;
}

/** "Próxima rodada disponível às 15h40." */
export function nextRoundAt(availableAt: Date, now = new Date()): string {
  const when = brasiliaTime(availableAt, now);
  return when.includes(" às ")
    ? `Próxima rodada disponível em ${when}.`
    : `Próxima rodada disponível às ${when}.`;
}

export const siteSlotCopy = {
  blocked: "Termine e publique o site que está em andamento para criar outro. Ou descarte-o.",
  openSite: "Ir para o site em andamento",
} as const;

export const extraRoundRule = `Depois dos refazeres grátis, você pode pedir mais 1 rodada a cada ${limits.extraRoundWaitMinutes === 60 ? "hora" : `${limits.extraRoundWaitMinutes} minutos`}.`;

/** "Este site será apagado em 7 dias se não houver novidades." */
export function deletionNotice(daysLeft: number): string {
  if (daysLeft <= 1) return "Este site será apagado amanhã se não houver novidades.";
  return `Este site será apagado em ${daysLeft} dias se não houver novidades.`;
}
