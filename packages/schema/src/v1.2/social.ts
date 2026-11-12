// Instagram and Facebook names (E38). The client pastes all sorts of things: "@nome", the
// profile's link from the app (with ?igsh=...), the mobile site (m.), fb.com, a line break.
// `normalizeSocial` keeps only the name when that is safe; `socialProblem` says exactly what is
// wrong with what is left. The schemas (primitives.ts) use the same messages, so the client
// and the server always agree. Messages are user-facing (pt-BR).

export type SocialNetwork = "instagram" | "facebook";

const NAME: Record<SocialNetwork, string> = { instagram: "Instagram", facebook: "Facebook" };

/** The network's own addresses, any subdomain (www., m., mobile., web., business.). */
const HOSTS: Record<SocialNetwork, RegExp> = {
  instagram: /^(?:[a-z]+\.)?(?:instagram\.com|instagr\.am)$/i,
  facebook: /^(?:[a-z]+\.)?(?:facebook\.com|fb\.com|fb\.me)$/i,
};

/** Other networks people paste by mistake. */
const OTHERS: [RegExp, string][] = [
  [/(?:^|\.)(?:instagram\.com|instagr\.am)$/i, "Instagram"],
  [/(?:^|\.)(?:facebook\.com|fb\.com|fb\.me)$/i, "Facebook"],
  [/(?:^|\.)tiktok\.com$/i, "TikTok"],
  [/(?:^|\.)(?:youtube\.com|youtu\.be)$/i, "YouTube"],
  [/(?:^|\.)(?:wa\.me|whatsapp\.com)$/i, "WhatsApp"],
  [/(?:^|\.)(?:x\.com|twitter\.com)$/i, "X"],
  [/(?:^|\.)linktr\.ee$/i, "Linktree"],
];

export const SOCIAL_RULES: Record<SocialNetwork, RegExp> = {
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  // A numbered profile (profile.php?id=...) has no page name: refused (E38; it used to be saved
  // as the name "profile.php").
  facebook: /^(?!profile\.php$)[A-Za-z0-9.-]{3,50}$/,
};

/** The host of a pasted address, or null when the text is not one. */
function hostOf(text: string): string | null {
  const match = /^(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:[/?#]|$)/i.exec(text);
  if (!match) return null;
  // "padaria.doze" is a valid Instagram name, not a site: only a path or a scheme makes it one.
  if (!/^https?:\/\//i.test(text) && !/[/?#]/.test(text.slice((match[1] ?? "").length))) {
    return null;
  }
  return (match[1] ?? "").toLowerCase();
}

/**
 * The name to keep. Safe changes only: spaces and line breaks at the ends, a leading @, the
 * network's own address (any subdomain, with or without https://) and what follows the name
 * (a slash, ?igsh=..., #...). Anything else stays as written, so `socialProblem` can say what
 * is wrong instead of guessing.
 */
export function normalizeSocial(input: string, network: SocialNetwork): string {
  let text = input.replace(/[​-‍﻿]/g, "").trim();
  const host = hostOf(text);
  if (host && HOSTS[network].test(host)) {
    const path = text.replace(/^(?:https?:\/\/)?[^/?#]+/i, "");
    // Facebook's numbered profiles keep their marker for the message below.
    if (network === "facebook" && /^\/profile\.php/i.test(path)) return "profile.php";
    text = path.replace(/^\/+/, "").replace(/[/?#].*$/s, "");
  }
  return text.replace(/^@+/, "").trim();
}

/** What is wrong with a name, in the client's words, or null when it is valid. */
export function socialProblem(handle: string, network: SocialNetwork): string | null {
  if (SOCIAL_RULES[network].test(handle)) return null;
  const name = NAME[network];
  if (network === "facebook" && /^profile\.php/i.test(handle)) {
    return "Perfis do Facebook com número (profile.php) não são aceitos: use o nome da página.";
  }
  const host = hostOf(handle);
  if (host) {
    const other = OTHERS.find(([pattern]) => pattern.test(host))?.[1];
    if (other && other !== name) {
      return `Esse endereço parece ser do ${other}. Cole o link do ${name} ou só o nome de usuário.`;
    }
    return `Isso parece o endereço de um site. Informe só o nome de usuário do ${name}.`;
  }
  if (/\s/.test(handle)) return `O nome de usuário do ${name} não tem espaços.`;
  if (handle.includes("@")) return `Informe o nome de usuário do ${name} sem @.`;
  const max = network === "instagram" ? 30 : 50;
  if (handle.length > max) return `O nome de usuário do ${name} tem no máximo ${max} caracteres.`;
  if (network === "facebook" && handle.length < 3) {
    return "O nome da página do Facebook tem pelo menos 3 caracteres.";
  }
  return network === "instagram"
    ? "Use só letras sem acento, números, ponto (.) e sublinhado (_)."
    : "Use só letras sem acento, números, ponto (.) e hífen (-).";
}
