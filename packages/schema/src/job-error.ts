// What a failed generation job says, for the team (E39). The jobs mask the error before they
// store it, and the admin API masks it again before it returns it: no key, token or password
// ever reaches the database or the panel. The causes table turns the raw text into a summary
// and a next step in pt-BR. Clients never see any of this; they only get the generic message.

/** Longest error kept, in characters. */
export const JOB_ERROR_MAX = 2000;

const HIDDEN = "[oculto]";

/** Environment names whose values are secrets. */
const SECRET_NAME = /KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|DATABASE_URL|DSN/i;

/** The values of the secret variables of an environment, longest first, to mask by value. */
export function envSecrets(env: Record<string, string | undefined>): string[] {
  return Object.entries(env)
    .filter(([name, value]) => SECRET_NAME.test(name) && typeof value === "string")
    .map(([, value]) => (value as string).trim())
    .filter((value) => value.length >= 8)
    .sort((a, b) => b.length - a.length);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATTERNS: [RegExp, string][] = [
  // user:password@ in any URL.
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${HIDDEN}@`],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${HIDDEN}`],
  // JSON Web Tokens (Supabase keys and sessions).
  [/\beyJ[A-Za-z0-9_-]{5,}(?:\.[A-Za-z0-9_-]*){0,2}/g, `[jwt ${HIDDEN.slice(1, -1)}]`],
  // Anthropic (sk-ant-...), and other sk- keys.
  [/\bsk-[A-Za-z0-9_-]{6,}/g, `sk-${HIDDEN}`],
  // Trigger.dev (tr_dev_, tr_prod_, tr_pat_).
  [/\btr_[A-Za-z0-9_]{6,}/g, `tr_${HIDDEN}`],
  // Supabase's own key formats.
  [/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{6,}/g, `sb_${HIDDEN}`],
  // apikey=..., "api_key": "...", x-api-key: ..., token=..., password=...
  [
    /\b(x-api-key|api[_-]?key|apikey|access[_-]?token|token|secret|password|passwd)(["']?\s*[:=]\s*["']?)[^\s"',;&)]+/gi,
    `$1$2${HIDDEN}`,
  ],
  // Long base64 or hex runs (with a digit, so long words and paths stay).
  [
    /(?<![A-Za-z0-9+/=_-])(?=[A-Za-z0-9+/_-]*\d)(?=[A-Za-z0-9+/_-]*[A-Za-z])[A-Za-z0-9+/_-]{40,}={0,2}/g,
    "[dados ocultos]",
  ],
];

/**
 * The error as it may be stored and shown to the team: secrets masked (by value, from
 * `secrets`, then by shape), line breaks tidied, and at most JOB_ERROR_MAX characters (the start
 * and the end, where the message and the last log lines are).
 */
export function maskJobError(raw: unknown, secrets: readonly string[] = []): string {
  let text = typeof raw === "string" ? raw : raw instanceof Error ? raw.message : String(raw ?? "");
  for (const secret of secrets) {
    if (secret.length >= 8) text = text.replace(new RegExp(escapeRegExp(secret), "g"), HIDDEN);
  }
  for (const [pattern, replacement] of PATTERNS) text = text.replace(pattern, replacement);
  text = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length <= JOB_ERROR_MAX) return text;
  const tail = 600;
  const cut = text.length - JOB_ERROR_MAX;
  const marker = `\n[… ${cut} caracteres omitidos …]\n`;
  const head = JOB_ERROR_MAX - tail - marker.length;
  return `${text.slice(0, head)}${marker}${text.slice(-tail)}`;
}

export interface JobErrorCause {
  id: string;
  /** What happened, in plain words (pt-BR). */
  summary: string;
  /** What to do next (pt-BR). */
  action: string;
}

/**
 * Known causes, most specific first. Matched against the masked text. The build comes before the
 * network: Astro's logs carry harmless "fetch failed" warnings about fonts.
 */
export const JOB_ERROR_CAUSES: (JobErrorCause & { pattern: RegExp })[] = [
  {
    id: "keep-names",
    pattern: /__name is not defined/,
    summary:
      "O revisor não conseguiu rodar no navegador: o código empacotado chama __name, que não existe na página.",
    action:
      "Corrigido no E39. Rode “Deploy jobs” com a versão atual da main e use “Tentar de novo”.",
  },
  {
    id: "memory",
    pattern:
      /TASK_PROCESS_OOM_KILLED|out of memory|heap out of memory|JavaScript heap|ENOMEM|\bOOM\b|Target crashed|Page crashed/i,
    summary: "Faltou memória na máquina da tarefa (o processo ou o navegador foi encerrado).",
    action:
      "Confira no Trigger.dev a máquina do site-job (medium-2x, com nova tentativa em large-1x) e use “Tentar de novo”.",
  },
  {
    id: "stopped",
    pattern: /O processo parou sem terminar a tarefa/,
    summary: "A tarefa parou no meio, sem dizer por quê.",
    action:
      "Abra a execução no Trigger.dev (Runs) para ver o motivo; costuma ser falta de memória. Depois, “Tentar de novo”.",
  },
  {
    id: "anthropic-credit",
    pattern: /credit balance|insufficient[_ ]credit|spend(?:ing)? limit|billing/i,
    summary: "A conta da Anthropic está sem créditos ou no limite de gasto.",
    action: "Confira o saldo e o limite de gasto no Console da Anthropic, depois “Tentar de novo”.",
  },
  {
    id: "anthropic-auth",
    pattern:
      /invalid x-api-key|authentication_error|permission_error|anthropic[^\n]{0,80}\b(?:401|403)\b|\b(?:401|403)\b[^\n]{0,80}anthropic/i,
    summary: "A Anthropic recusou a chave de API.",
    action:
      "Confira ANTHROPIC_API_KEY nas variáveis de produção do Trigger.dev (sem espaços), depois “Tentar de novo”.",
  },
  {
    id: "supabase",
    pattern:
      // Case-sensitive: the masked "[jwt oculto]" must not match.
      /\bJWT\b|JWSError|row-level security|[Bb]ucket not found|PGRST\d+|permission denied for (?:table|relation|function)|[Ss]upabase/,
    summary: "O Supabase (banco ou arquivos) recusou a operação.",
    action:
      "Confira SUPABASE_URL e SUPABASE_SECRET_KEY no Trigger.dev, se os buckets existem e se as migrações estão aplicadas.",
  },
  {
    id: "cloudflare",
    pattern:
      /cloudflare|\bR2\b|\bKV\b|api\.cloudflare\.com|NoSuchBucket|AccessDenied|InvalidAccessKeyId|SignatureDoesNotMatch/i,
    summary: "O Cloudflare (R2 ou KV) recusou a operação.",
    action:
      "Confira no Trigger.dev o id da conta, o token e os nomes do bucket R2 e do namespace KV, depois “Tentar de novo”.",
  },
  {
    id: "build",
    pattern: /O build falhou/,
    summary: "O Astro não conseguiu montar o site.",
    action:
      "Leia o fim do log do build nos detalhes técnicos; costuma apontar o arquivo e a linha.",
  },
  {
    id: "network",
    pattern:
      /ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed|timed? ?out|timeout/i,
    summary: "Uma conexão caiu ou demorou demais.",
    action:
      "Costuma passar sozinho: use “Tentar de novo”. Se repetir, veja nos detalhes qual serviço não respondeu.",
  },
];

/** The known cause of an error, or null ("Erro não reconhecido"). */
export function explainJobError(text: string | null | undefined): JobErrorCause | null {
  if (!text) return null;
  const found = JOB_ERROR_CAUSES.find((cause) => cause.pattern.test(text));
  if (!found) return null;
  const { pattern: _, ...cause } = found;
  return cause;
}

/** One line for lists: the known cause, else the error's first line, cut at `max`. */
export function shortJobError(text: string | null | undefined, max = 120): string | null {
  if (!text) return null;
  const known = explainJobError(text);
  if (known) return known.summary;
  const line =
    text
      .split("\n")
      .find((item) => item.trim())
      ?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
