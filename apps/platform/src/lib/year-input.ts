import { businessAnswersSchema } from "@brotasites/schema/v1.2";

// "Ano em que começou" (E38). The field shows what the person types; the draft gets a number
// only once there are 4 digits. Before, the field showed the saved number, which existed only
// at 4 digits, so typing "1", "19", "199" was thrown away and the field looked dead.

/** What the field keeps: digits only, at most 4 (letters and spaces are dropped as typed). */
export function yearText(typed: string): string {
  return typed.replace(/\D/g, "").slice(0, 4);
}

/** The year for the draft: a number at 4 digits, otherwise nothing. */
export function yearValue(text: string): number | undefined {
  return text.length === 4 ? Number(text) : undefined;
}

/**
 * The message under the field, or null. A whole year is checked with the schema (the same
 * messages as the server); fewer digits are flagged only once the person leaves the field or
 * tries to move on (`done`), never while typing.
 */
export function yearProblem(text: string, done: boolean): string | null {
  if (text === "") return null;
  if (text.length < 4) return done ? "Use 4 números, como 1998." : null;
  const checked = businessAnswersSchema.shape.foundedYear.safeParse(Number(text));
  return checked.success ? null : (checked.error.issues[0]?.message ?? "Confira o ano.");
}
