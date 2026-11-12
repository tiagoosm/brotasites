// What each place BrotaSites runs in needs from the environment (E34): the single list behind
// `pnpm check:launch` and docs/launch-status.md. It was written from what the code reads
// (process.env in apps/platform, apps/jobs, apps/sites-worker and packages/*), not from the
// docs. Pure: no file, network or process access here, so it is tested on its own.
//
// need:
//   required    the target does not work without it
//   generation  creating sites needs it (the platform refuses to create without it, E34)
//   launch      needed before accepting real clients, not before testing
//   optional    a default applies; set it only to change that default
// secret: the value is never printed, only "presente" or "faltando".

/** @typedef {"vercel" | "trigger" | "worker"} Target */
/** @typedef {"required" | "generation" | "launch" | "optional"} Need */
/**
 * @typedef {object} Variable
 * @property {string} name
 * @property {Target} target
 * @property {Need} need
 * @property {boolean} secret
 * @property {string} expected  the value or kind of value expected in production (never a secret)
 * @property {string} without   what happens without it
 * @property {string} step      the owner's step that sets it (docs/launch-status.md)
 * @property {string} [mustBe]  an exact value production needs
 */

/** @type {Variable[]} */
export const VARIABLES = [
  // Vercel: the platform (apps/platform). ---------------------------------------------------
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    target: "vercel",
    need: "required",
    secret: false,
    expected: "https://<project>.supabase.co",
    without: "No sign-in, no account pages.",
    step: "vercel-base",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    target: "vercel",
    need: "required",
    secret: false,
    expected: "sb_publishable_…",
    without: "No sign-in, no account pages.",
    step: "vercel-base",
  },
  {
    name: "SUPABASE_SECRET_KEY",
    target: "vercel",
    need: "required",
    secret: true,
    expected: "sb_secret_…",
    without: "Account creation, sites, the team's panel and the cron fail (503).",
    step: "vercel-base",
  },
  {
    name: "NEXT_PUBLIC_PLATFORM_URL",
    target: "vercel",
    need: "required",
    secret: false,
    expected: "https://brotasites.com.br",
    without: "The production build stops (E28).",
    step: "vercel-base",
  },
  {
    name: "NEXT_PUBLIC_BASE_DOMAIN",
    target: "vercel",
    need: "required",
    secret: false,
    expected: "brotasites.com",
    without: "The production build stops (E28); creating sites stays closed (E34).",
    step: "vercel-base",
  },
  {
    name: "NEXT_PUBLIC_ADMIN_HOST",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "admin.brotasites.com.br",
    without: "/admin stays on the platform's address.",
    step: "vercel-base",
  },
  {
    name: "CRON_SECRET",
    target: "vercel",
    need: "required",
    secret: true,
    expected: "a long random string",
    without: "The daily keep-alive is refused, and Supabase Free may pause.",
    step: "vercel-base",
  },
  {
    name: "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    target: "vercel",
    need: "launch",
    secret: false,
    expected: "0x… (Turnstile site key)",
    without:
      "With NEXT_PUBLIC_CAPTCHA_MODE=off: no bot protection; without both, sign-in and sign-up are refused in production.",
    step: "turnstile",
  },
  {
    name: "NEXT_PUBLIC_CAPTCHA_MODE",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "off (only until Turnstile), then empty",
    without:
      'With no Turnstile key either: sign-in and sign-up refused in production. Never "simulated" there.',
    step: "vercel-base",
  },
  {
    name: "TRIGGER_SECRET_KEY",
    target: "vercel",
    need: "generation",
    secret: true,
    expected: "tr_prod_…",
    without: "No job ever starts: creating sites stays closed (E34).",
    step: "vercel-generation",
  },
  {
    name: "CLOUDFLARE_ACCOUNT_ID",
    target: "vercel",
    need: "generation",
    secret: false,
    expected: "the Cloudflare account id (32 hex)",
    without: "Suspending a site does not reach the Worker; creating sites stays closed.",
    step: "vercel-generation",
  },
  {
    name: "CLOUDFLARE_KV_NAMESPACE_ID",
    target: "vercel",
    need: "generation",
    secret: false,
    expected: "the KV namespace id (32 hex)",
    without: "Same as above.",
    step: "vercel-generation",
  },
  {
    name: "CLOUDFLARE_KV_API_TOKEN",
    target: "vercel",
    need: "generation",
    secret: true,
    expected: "a token that only edits that namespace",
    without: "Same as above.",
    step: "vercel-generation",
  },
  {
    name: "NEXT_PUBLIC_PREVIEW_ORIGIN",
    target: "vercel",
    need: "generation",
    secret: false,
    expected: "https://previa.brotasites.com",
    without: "Previews point to the local runner (127.0.0.1); creating sites stays closed.",
    step: "vercel-generation",
  },
  {
    name: "EXPORT_SECRET",
    target: "vercel",
    need: "generation",
    secret: true,
    expected: "a long random string, the same as the Worker's",
    without: 'No "Baixar o site" link.',
    step: "vercel-generation",
  },
  {
    name: "PAYMENTS_MODE",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "stub until Asaas (E-later); never stub with real clients",
    without: "Approval and publishing are off.",
    step: "payments",
  },
  {
    name: "SUPABASE_FORWARD_IP",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "true once IP forwarding is on in Supabase",
    without: "Supabase's per-IP limits see Vercel's IPs.",
    step: "vercel-base",
  },
  {
    name: "AI_DAILY_BUDGET_USD",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "20 (default)",
    without: "Default 20.",
    step: "vercel-base",
  },
  {
    name: "AI_BUDGET_ALERT_RATIO",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "0.8 (default)",
    without: "Default 0.8.",
    step: "vercel-base",
  },
  {
    name: "AI_ROUNDS_PER_SITE_PER_DAY",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "20 (default)",
    without: "Default 20.",
    step: "vercel-base",
  },
  {
    name: "AI_ROUNDS_PER_ACCOUNT_PER_DAY",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "40 (default)",
    without: "Default 40.",
    step: "vercel-base",
  },
  {
    name: "NEXT_PUBLIC_CONTACT_EMAIL",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "contato@brotasites.com.br (default)",
    without: "Default from the platform's host.",
    step: "vercel-base",
  },
  {
    name: "NEXT_PUBLIC_PRIVACY_EMAIL",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "privacidade@brotasites.com.br (default)",
    without: "Default from the platform's host.",
    step: "vercel-base",
  },
  {
    name: "NEXT_PUBLIC_ABUSE_EMAIL",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "abuso@brotasites.com.br (default)",
    without: "Default from the platform's host.",
    step: "vercel-base",
  },
  {
    name: "DOMAINS_MODE",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "empty until E25 is set up, then cloudflare",
    without: "The client's own domain flow says it is coming soon.",
    step: "client-domains",
  },
  {
    name: "CLOUDFLARE_SAAS_ZONE_ID",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "the brotasites.com zone id",
    without: "Only with DOMAINS_MODE=cloudflare.",
    step: "client-domains",
  },
  {
    name: "CLOUDFLARE_SAAS_API_TOKEN",
    target: "vercel",
    need: "optional",
    secret: true,
    expected: "a token for that zone's custom hostnames",
    without: "Only with DOMAINS_MODE=cloudflare.",
    step: "client-domains",
  },
  {
    name: "CUSTOM_DOMAIN_TARGET",
    target: "vercel",
    need: "optional",
    secret: false,
    expected: "clientes.brotasites.com (default)",
    without: "Default clientes.<BASE_DOMAIN>.",
    step: "client-domains",
  },

  // Trigger.dev: the jobs (apps/jobs, with packages/ai, generator, templates, reviewer). ------
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    target: "trigger",
    need: "required",
    secret: false,
    expected: "https://<project>.supabase.co (or SUPABASE_URL)",
    without: "Every job fails at start.",
    step: "trigger",
  },
  {
    name: "SUPABASE_SECRET_KEY",
    target: "trigger",
    need: "required",
    secret: true,
    expected: "sb_secret_…",
    without: "Every job fails at start.",
    step: "trigger",
  },
  {
    name: "AI_MODE",
    target: "trigger",
    need: "required",
    secret: false,
    expected: "live",
    mustBe: "live",
    without: "Simulated AI: placeholder texts, never for clients.",
    step: "trigger",
  },
  {
    name: "AI_MODEL_ID",
    target: "trigger",
    need: "required",
    secret: false,
    expected: "claude-opus-5-5 (decision of E8)",
    without: "With AI_MODE=live, every job fails.",
    step: "trigger",
  },
  {
    name: "ANTHROPIC_API_KEY",
    target: "trigger",
    need: "required",
    secret: true,
    expected: "sk-ant-…",
    without: "With AI_MODE=live, every job fails.",
    step: "anthropic",
  },
  {
    name: "AI_EFFORT",
    target: "trigger",
    need: "optional",
    secret: false,
    expected: "medium (default)",
    without: "Default medium.",
    step: "trigger",
  },
  {
    name: "CLOUDFLARE_ACCOUNT_ID",
    target: "trigger",
    need: "required",
    secret: false,
    expected: "the Cloudflare account id",
    without: "Previews and sites cannot be stored: the job stops.",
    step: "trigger",
  },
  {
    name: "R2_ACCESS_KEY_ID",
    target: "trigger",
    need: "required",
    secret: true,
    expected: "R2 token's access key",
    without: "Same as above.",
    step: "cloudflare",
  },
  {
    name: "R2_SECRET_ACCESS_KEY",
    target: "trigger",
    need: "required",
    secret: true,
    expected: "R2 token's secret",
    without: "Same as above.",
    step: "cloudflare",
  },
  {
    name: "R2_BUCKET",
    target: "trigger",
    need: "optional",
    secret: false,
    expected: "brotasites-sites (default)",
    without: "Default brotasites-sites.",
    step: "trigger",
  },
  {
    name: "CLOUDFLARE_KV_NAMESPACE_ID",
    target: "trigger",
    need: "required",
    secret: false,
    expected: "the KV namespace id",
    without: "Published sites and previews never reach the Worker.",
    step: "trigger",
  },
  {
    name: "CLOUDFLARE_KV_API_TOKEN",
    target: "trigger",
    need: "required",
    secret: true,
    expected: "a token that only edits that namespace",
    without: "Same as above.",
    step: "cloudflare",
  },
  {
    name: "BASE_DOMAIN",
    target: "trigger",
    need: "required",
    secret: false,
    expected: "brotasites.com",
    without: "Sites are built for sites.localhost.",
    step: "trigger",
  },
  {
    name: "REVIEW_SKIP_HUMAN",
    target: "trigger",
    need: "optional",
    secret: false,
    expected: "false (default): every site goes through a person",
    without: "Default false.",
    step: "trigger",
  },
  {
    name: "AI_CODE_VARIANTS",
    target: "trigger",
    need: "optional",
    secret: false,
    expected: "false (default)",
    without: "Default false.",
    step: "trigger",
  },

  // The sites Worker (apps/sites-worker): wrangler.jsonc vars, a secret, and the deploy. --------
  {
    name: "BASE_DOMAIN",
    target: "worker",
    need: "required",
    secret: false,
    expected: "brotasites.com (wrangler.jsonc vars)",
    without: "The Worker answers for the wrong domain.",
    step: "cloudflare",
  },
  {
    name: "PLATFORM_URL",
    target: "worker",
    need: "required",
    secret: false,
    expected: "https://brotasites.com.br (wrangler.jsonc vars)",
    without: "The bare sites domain redirects nowhere.",
    step: "cloudflare",
  },
  {
    name: "KV_NAMESPACE_ID",
    target: "worker",
    need: "required",
    secret: false,
    expected: "the HOSTING namespace id in wrangler.jsonc (not zeros)",
    without: "wrangler deploy fails.",
    step: "cloudflare",
  },
  {
    name: "EXPORT_SECRET",
    target: "worker",
    need: "generation",
    secret: true,
    expected: "wrangler secret put EXPORT_SECRET (same value as Vercel's)",
    without: '"Baixar o site" links are refused.',
    step: "cloudflare",
  },
  {
    name: "CLOUDFLARE_API_TOKEN",
    target: "worker",
    need: "required",
    secret: true,
    expected: "a token that deploys Workers (only where you run wrangler)",
    without: "wrangler deploy asks you to sign in instead.",
    step: "cloudflare",
  },
];

/** The owner's steps, in order, in Portuguese: what each one unlocks (docs/launch-status.md). */
export const STEPS = {
  "vercel-base":
    "Conferir na Vercel as variáveis básicas da plataforma (Supabase, endereços, CRON_SECRET, captcha) e fazer Redeploy.",
  cloudflare:
    "Criar no Cloudflare a zona brotasites.com, o bucket R2, o namespace KV e os tokens, e publicar o Worker (docs/owner-steps.md).",
  anthropic: "Criar a chave da Anthropic, com limite de gasto, e guardá-la só no Trigger.dev.",
  trigger:
    "Criar o projeto no Trigger.dev, colocar as variáveis de produção dos jobs e rodar o deploy (pnpm --filter @brotasites/jobs exec trigger deploy).",
  "vercel-generation":
    "Colocar na Vercel as variáveis da geração (TRIGGER_SECRET_KEY, Cloudflare KV, NEXT_PUBLIC_PREVIEW_ORIGIN, EXPORT_SECRET) e fazer Redeploy.",
  turnstile:
    "Ligar o Turnstile antes de aceitar clientes reais e tirar NEXT_PUBLIC_CAPTCHA_MODE=off.",
  payments: "Ligar o Asaas antes de cobrar (fora do escopo agora).",
  "client-domains": "Domínio próprio do cliente (E25): opcional, depois do lançamento.",
};

/** The order of the steps that unlock generation (docs/launch-status.md). */
export const STEP_ORDER = [
  "vercel-base",
  "cloudflare",
  "anthropic",
  "trigger",
  "vercel-generation",
  "turnstile",
  "payments",
  "client-domains",
];

/**
 * What the platform's generationReady() checks on Vercel (must equal GENERATION_VARIABLES in
 * apps/platform/src/lib/server/generation.ts; a test keeps them equal).
 */
export const GENERATION_ON_VERCEL = [
  "TRIGGER_SECRET_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_KV_NAMESPACE_ID",
  "CLOUDFLARE_KV_API_TOKEN",
  "NEXT_PUBLIC_BASE_DOMAIN",
  "NEXT_PUBLIC_PREVIEW_ORIGIN",
];

const PLACEHOLDERS = [
  /localhost/i,
  /127\.0\.0\.1/,
  /change-?me/i,
  /^0+$/,
  /example\.(com|org)/i,
  /^your[-_ ]/i,
  /<[^>]+>/,
];

/** Whether a value is still an example from .env.example or the docs. */
export function isPlaceholder(value) {
  const text = String(value ?? "").trim();
  return text !== "" && PLACEHOLDERS.some((pattern) => pattern.test(text));
}

/**
 * Compares an environment with what a target needs. Never returns a secret's value: each
 * variable comes back as "presente", "faltando", "vazia", "exemplo" or "valor errado".
 * @param {Target} target
 * @param {Record<string, string | undefined>} env
 */
export function checkTarget(target, env) {
  const rows = VARIABLES.filter((v) => v.target === target).map((v) => {
    const raw = env[v.name];
    let state = "presente";
    if (raw === undefined) state = "faltando";
    else if (raw.trim() === "") state = "vazia";
    else if (isPlaceholder(raw)) state = "exemplo";
    else if (v.mustBe && raw.trim() !== v.mustBe) state = "valor errado";
    return {
      name: v.name,
      need: v.need,
      secret: v.secret,
      state,
      step: v.step,
      expected: v.expected,
    };
  });
  // The captcha in production: a Turnstile key, or "off" until there is one.
  if (target === "vercel") {
    const key = rows.find((r) => r.name === "NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    const mode = env.NEXT_PUBLIC_CAPTCHA_MODE?.trim();
    if (key && key.state !== "presente" && mode !== "off") key.need = "required";
    const modeRow = rows.find((r) => r.name === "NEXT_PUBLIC_CAPTCHA_MODE");
    if (modeRow && mode === "simulated") modeRow.state = "valor errado";
  }
  const blocking = rows.filter(
    (r) => (r.need === "required" || r.need === "generation") && r.state !== "presente",
  );
  return { target, rows, blocking, ok: blocking.length === 0 };
}

/** The owner's next action, in one sentence, from the first blocking variable's step. */
export function nextAction(results) {
  const steps = new Set(results.flatMap((r) => r.blocking.map((b) => b.step)));
  const first = STEP_ORDER.find((step) => steps.has(step));
  if (!first)
    return "Tudo o que é obrigatório está presente. Rode com --online para conferir os endereços.";
  return `Próxima ação: ${STEPS[first]}`;
}

/** Reads a dotenv file's text: KEY=value lines, # comments, optional quotes. */
export function parseEnv(text) {
  const env = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2] ?? "";
    if (/^".*"$|^'.*'$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    env[match[1]] = value;
  }
  return env;
}

/** The Worker's own settings, from wrangler.jsonc's text (comments allowed). */
export function workerEnvFromWrangler(text) {
  const json = String(text)
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
  const config = JSON.parse(json);
  const kv = (config.kv_namespaces ?? []).find((n) => n.binding === "HOSTING");
  return {
    BASE_DOMAIN: config.vars?.BASE_DOMAIN,
    PLATFORM_URL: config.vars?.PLATFORM_URL,
    KV_NAMESPACE_ID: kv?.id,
    routes: Array.isArray(config.routes) ? config.routes.length : 0,
  };
}

/**
 * The network checks of --online, in Portuguese. `get(url)` is injected (fetch in the CLI, a
 * fake in the tests) and resolves to { status, location, body }.
 */
export async function onlineChecks({ platformUrl, adminHost, baseDomain }, get) {
  const checks = [];
  const run = async (label, url, test) => {
    try {
      const answer = await get(url);
      const [ok, detail] = test(answer);
      checks.push({ label, url, ok, detail });
    } catch (error) {
      checks.push({ label, url, ok: false, detail: `não respondeu (${error?.message ?? "erro"})` });
    }
  };
  await run("A plataforma responde", platformUrl, (a) => [a.status === 200, `status ${a.status}`]);
  if (adminHost) {
    await run(
      "O robots.txt da equipe é o do administrador",
      `https://${adminHost}/robots.txt`,
      (a) => [
        a.status === 200 && /Disallow:\s*\/\s*$/m.test(a.body ?? ""),
        a.status === 200 ? "bloqueia tudo" : `status ${a.status}`,
      ],
    );
  }
  await run("A prévia responde o 404 do Worker", `https://previa.${baseDomain}/`, (a) => [
    a.status === 404,
    `status ${a.status} (esperado 404 antes de existir uma prévia)`,
  ]);
  await run("A raiz dos sites leva à plataforma", `https://${baseDomain}/`, (a) => [
    a.status >= 300 && a.status < 400 && String(a.location ?? "").startsWith(platformUrl),
    a.location ? `redireciona para ${a.location}` : `status ${a.status}`,
  ]);
  await run(
    "Um subdomínio qualquer chega ao Worker",
    `https://teste-brotasites-check.${baseDomain}/`,
    (a) => [a.status === 404, `status ${a.status} (esperado 404 antes de existir o site)`],
  );
  return checks;
}
