import { domainProvider } from "@/lib/domains/provider";
import { clientIp, guardErrors, json, limitKey, refuse } from "@/lib/server/guard";
import { rulesFor, withinLimits } from "@/lib/server/rate-limit";
import { ownSite } from "@/lib/server/session";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { DomainRefusal } from "./domains";

// What every route of the client's own domain needs (E25): the site is the person's, the limits
// (per IP, per account and per site, a day), the service key on the server only, the hosting.

/** Tries per site a day (asking, checking, removing): plenty for a person, little for a script. */
const SITE_TRIES_PER_DAY = 30;

export async function domainContext(request: Request, siteId: string, countTry = true) {
  const owned = await ownSite(siteId);
  if ("error" in owned) return { error: owned.error } as const;
  if (countTry) {
    const rules = [
      ...rulesFor("domains", clientIp(request), owned.user.id, limitKey),
      { key: limitKey("domains-site", siteId), max: SITE_TRIES_PER_DAY, windowSeconds: 86_400 },
    ];
    if (!(await withinLimits(rules)))
      return { error: refuse(429, guardErrors.rateLimited) } as const;
  }
  const db = getAdminSupabase();
  if (!db) return { error: refuse(503, guardErrors.unavailable) } as const;
  return { owned, db, provider: domainProvider() } as const;
}

export const flowOff = () =>
  refuse(503, "A conexão de domínio próprio ainda não está disponível. Tente de novo em breve.");

/** A refusal in the client's words, or the generic one; never the hosting's own text. */
export function domainError(error: unknown) {
  if (error instanceof DomainRefusal) return refuse(error.status, error.message);
  return refuse(503, guardErrors.unavailable);
}

export { json };
