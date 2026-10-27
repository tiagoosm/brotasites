// Fact checking (docs/ai-and-reviewer.md, Copy): every number, phone, email, year or name in
// the AI's text must already be in the client's data, and the AI never writes links or claims
// such as awards and certifications the client did not make. Any issue discards the answer.

export interface FactIssue {
  kind: "number" | "number-word" | "link" | "email" | "handle" | "name" | "claim";
  value: string;
  /** Where in the answer (a field path). */
  field: string;
}

/** Lowercase, no accents, single spaces. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const stripZeros = (digits: string) => digits.replace(/^0+(?=\d)/, "");

const numberWords = [
  "dois",
  "duas",
  "tres",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quinze",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "cem",
  "cento",
  "centenas",
  "mil",
  "milhares",
  "dezenas",
  "milhao",
  "milhoes",
];

/** Claims only the client can make; flagged unless the client's own text has the word. */
const claims = [
  /\bpremiad[oa]s?\b/,
  /\bpremios?\b/,
  /\bcertificad[oa]s?\b/,
  /\bcertificac(ao|oes)\b/,
  /\bselo\b/,
  /\beleit[oa]s?\b/,
  /\bn[o°º.]*\s*1\b/,
  /\bnumero (1|um)\b/,
  /\bmelhor(es)?\b/,
  /\blider(es)?\b/,
  /\bespecialistas?\b/,
  /\bgarantid[oa]s?\b/,
  /\breconhecid[oa]s?\b/,
  /\bavaliac(ao|oes)\b/,
  /\bestrelas\b/,
];

/** Capitalized words that are not facts: weekdays, months, holidays, the contact channels. */
const commonCapitalized = new Set(
  [
    "whatsapp",
    "instagram",
    "facebook",
    "pix",
    "google",
    "maps",
    "natal",
    "pascoa",
    "carnaval",
    "ano novo",
    "dia das maes",
    "dia dos pais",
    "dia dos namorados",
    "brasil",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
    "domingo",
    "janeiro",
    "fevereiro",
    "marco",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ].map(normalize),
);

export interface FactSource {
  /** Every text the client gave, plus formatted values (hours, phone). */
  texts: string[];
}

export function checkFacts(fields: Record<string, string>, source: FactSource): FactIssue[] {
  const sourceText = normalize(source.texts.join(" \n "));
  const sourceDigits = new Set<string>();
  const longRuns: string[] = [];
  for (const text of source.texts) {
    for (const run of text.match(/\d+/g) ?? []) {
      sourceDigits.add(stripZeros(run));
    }
    // Phones and CEPs may be split differently in the answer: keep their digits joined.
    const joined = text.replace(/[\s().-]/g, "");
    for (const run of joined.match(/\d{8,}/g) ?? []) longRuns.push(run);
  }
  const sourceWords = new Set(sourceText.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const issues: FactIssue[] = [];

  for (const [field, text] of Object.entries(fields)) {
    if (!text) continue;
    const plain = normalize(text);

    if (/https?:|www\.|\b[\w-]+\.(com|net|org|br|io|app|site|online)\b/i.test(text)) {
      issues.push({ kind: "link", value: text, field });
    }
    for (const email of text.match(/[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi) ?? []) {
      if (!sourceText.includes(normalize(email)))
        issues.push({ kind: "email", value: email, field });
    }
    for (const handle of text.match(/(^|\s)@[\w.]+/g) ?? []) {
      const name = handle.trim().slice(1);
      if (!sourceWords.has(normalize(name)) && !sourceText.includes(normalize(name))) {
        issues.push({ kind: "handle", value: handle.trim(), field });
      }
    }
    const withoutEmails = text.replace(/[^\s@]+@[^\s@]+/g, " ");
    for (const run of withoutEmails.match(/\d+/g) ?? []) {
      const digits = stripZeros(run);
      const known =
        sourceDigits.has(digits) ||
        (run.length >= 2 && longRuns.some((long) => long.includes(run)));
      if (!known) issues.push({ kind: "number", value: run, field });
    }
    for (const word of plain.split(/[^\p{L}]+/u)) {
      if (numberWords.includes(word) && !sourceWords.has(word)) {
        issues.push({ kind: "number-word", value: word, field });
      }
    }
    for (const claim of claims) {
      const found = claim.exec(plain);
      if (found && !claim.test(sourceText)) issues.push({ kind: "claim", value: found[0], field });
    }
    issues.push(...checkNames(text, field, sourceText));
  }
  return issues;
}

const connector = /^(d[aeo]s?|e|del|di|du|van|von)$/i;

/** Proper names (capitalized words not opening a sentence) that the client never wrote. */
function checkNames(text: string, field: string, sourceText: string): FactIssue[] {
  const issues: FactIssue[] = [];
  for (const sentence of text.split(/(?<=[.!?:;—–\n])\s+|\n/)) {
    const words = sentence.split(/\s+/).filter(Boolean);
    let run: string[] = [];
    const flush = () => {
      while (run.length > 0 && connector.test(run[run.length - 1] as string)) run.pop();
      if (run.length > 0) {
        const known = (words: string[]) => {
          const key = normalize(words.join(" ").replace(/[^\p{L}\p{N}\s'’-]/gu, ""));
          return !key || sourceText.includes(key) || commonCapitalized.has(key);
        };
        if (!known(run)) {
          // Two known names joined by "de", "do"...: check each part on its own.
          const parts: string[][] = [[]];
          for (const word of run) {
            if (connector.test(word)) parts.push([]);
            else parts[parts.length - 1]?.push(word);
          }
          for (const part of parts) {
            if (part.length > 0 && !known(part)) {
              issues.push({ kind: "name", value: part.join(" "), field });
            }
          }
        }
      }
      run = [];
    };
    words.forEach((raw, index) => {
      const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (!word) {
        flush();
        return;
      }
      const isCapital = /^\p{Lu}/u.test(word);
      if (isCapital && index > 0) run.push(word);
      else if (run.length > 0 && connector.test(word)) run.push(word);
      else flush();
      if (/[,()"“”]/.test(raw.slice(-1))) flush();
    });
    flush();
  }
  return issues;
}
