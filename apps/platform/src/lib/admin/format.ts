import { limits, usdToBrlEstimate } from "@/config/limits";

// Numbers of the team panel (E24), in pt-BR. Money in dollars as the model is billed, with an
// estimate in reais from config/limits.ts (marked as an estimate, never a price).

const usd = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integer = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

export const NO_DATA = "sem dados ainda";

export function formatUsd(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return NO_DATA;
  return usd.format(Number(value));
}

/** "≈ R$ 5,50 (estimativa)". */
export function formatBrlEstimate(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `≈ ${brl.format(usdToBrlEstimate(Number(value)))} (estimativa)`;
}

export function formatCount(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return NO_DATA;
  return integer.format(Number(value));
}

/** The share that passed from one stage to the next; empty when the first is 0. */
export function passRate(from: number, to: number): string {
  return from > 0 ? percent.format(to / from) : "–";
}

export function formatPercent(ratio: number): string {
  return percent.format(ratio);
}

export const rateNote = limits.usdToBrl.toVerify
  ? `Câmbio de ${brl.format(limits.usdToBrl.rate)} por dólar, a verificar (config/limits.ts).`
  : `Câmbio de ${brl.format(limits.usdToBrl.rate)} por dólar.`;

/** "05/11", a day of the cost table (YYYY-MM-DD). */
export function shortDay(day: string): string {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

/** "03/11/2026 15:40", in Brasília. */
export function dateTime(at: string | null | undefined): string {
  if (!at) return "–";
  return new Date(at).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}
