// Helpers for the contact question: people type phone numbers and ZIP codes the way they
// write them ("(35) 99999-0000"); the config keeps the digits the site needs.

export const brazilianStates = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const digitsOf = (value: string) => value.replace(/\D/g, "");

/**
 * WhatsApp number as the config stores it: country code, area code and number, digits only.
 * Numbers typed without the country code (10 or 11 digits) get Brazil's 55.
 */
export function whatsappDigits(input: string): string {
  const digits = digitsOf(input);
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

/** "5535999990000" or "35999990000" → "(35) 99999-0000". Partial numbers format as typed. */
export function formatPhone(input: string): string {
  let digits = digitsOf(input);
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits;
  const area = digits.slice(0, 2);
  const rest = digits.slice(2);
  const split = rest.length > 8 ? 5 : 4;
  return rest.length > split
    ? `(${area}) ${rest.slice(0, split)}-${rest.slice(split)}`
    : `(${area}) ${rest}`;
}

/** "37540000" → "37540-000". */
export function formatZip(input: string): string {
  const digits = digitsOf(input).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}
