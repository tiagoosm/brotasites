// Every cost limit of the platform, in one place (owner's decisions of 2026-11-03, PLAN.md E24).
// The database enforces them: the server routes send these values with each call, validated
// there (out of range is refused), and the client's own calls use the last values sent. The AI's
// own daily limits per site and per account and the global budget (packages/ai, SpendingGuard)
// stay as they are; these add to them.

export const limits = {
  /** Rounds of directions free per site: the first one and two redos. */
  freeDirectionRounds: 3,
  /** After the free rounds, one more round per this many minutes. The count never resets. */
  extraRoundWaitMinutes: 60,
  /** Unpaid sites in progress per account (a team exception can add more). */
  openSitesPerAccount: 1,
  /** Days without any action from the person before an unpaid site is deleted. */
  idleDaysBeforeDeletion: 30,
  /** Warnings on the dashboard this many days before the deletion (at day 23 and day 29). */
  deletionWarningDays: [7, 1],
  /** The daily cleanup removes at most this many sites per run. */
  cleanupBatch: 25,
  /**
   * USD to BRL, only for the estimates in the team panel. To verify: updated by hand, never
   * used for a price.
   */
  usdToBrl: { rate: 5.5, checkedOn: null as string | null, toVerify: true },
} as const;

export const extraRoundWaitSeconds = limits.extraRoundWaitMinutes * 60;

const clock = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});
const dayAndClock = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** "15h40" in Brasília; "05/11 às 15h40" when it is another day there. */
export function brasiliaTime(at: Date, now = new Date()): string {
  const day = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
  const time = clock.format(at).replace(":", "h");
  if (day(at) === day(now)) return time;
  const [date] = dayAndClock.format(at).split(/,?\s/);
  return `${date} às ${time}`;
}

/** The estimate in reais of a cost in dollars (team panel only). */
export function usdToBrlEstimate(usd: number): number {
  return usd * limits.usdToBrl.rate;
}
