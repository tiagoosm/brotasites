import { z } from "zod";
import { extraRoundWaitSeconds, limits } from "@/config/limits";
import { nextRoundAt } from "@/lib/limits-copy";
import { generationClosed, generationReady } from "@/lib/server/generation";
import { clientIp, guardErrors, json, limitKey, readBody, refuse } from "@/lib/server/guard";
import { triggerJob } from "@/lib/server/jobs";
import { rulesFor, withinLimits } from "@/lib/server/rate-limit";
import { accountErrors, errors, ownSite } from "@/lib/server/session";
import { getAdminSupabase } from "@/lib/supabase/admin";

// A round of directions (E24): free rounds, then one per wait, decided by the database under a
// row lock (server_request_directions) with the values from config/limits.ts. In production,
// only once generation is set up (E34, lib/server/generation.ts).

const known: Record<string, [number, string]> = {
  wrong_status: [409, "Este passo não está disponível agora. Atualize a página."],
  site_not_found: [404, errors.notFound],
  email_not_confirmed: [403, accountErrors.emailNotConfirmed],
  needs_v12: [409, "Este site foi criado na versão antiga. Crie um novo site."],
  rate_limited: [429, "Você chegou ao limite de pedidos de hoje. Tente de novo amanhã."],
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await readBody(request, z.object({}).strict());
  if ("error" in body) return body.error;
  const { id } = await params;
  const owned = await ownSite(id);
  if ("error" in owned) return owned.error;
  // E34: no job that cannot start. The answers stay saved in the draft for when it opens.
  if (!generationReady()) {
    return json({ error: generationClosed.text, code: generationClosed.code }, 503);
  }
  if (!(await withinLimits(rulesFor("sites", clientIp(request), owned.user.id, limitKey)))) {
    return refuse(429, guardErrors.rateLimited);
  }
  const admin = getAdminSupabase();
  if (!admin) return refuse(503, guardErrors.unavailable);
  const { data, error } = await admin.rpc("server_request_directions", {
    p_site_id: id,
    p_user_id: owned.user.id,
    p_free_rounds: limits.freeDirectionRounds,
    p_wait_seconds: extraRoundWaitSeconds,
  });
  if (error) {
    const code = Object.keys(known).find((key) => error.message?.includes(key));
    const [status, message] = code ? (known[code] as [number, string]) : [503, errors.unavailable];
    return refuse(status, message);
  }
  const result = data as {
    ok: boolean;
    jobId?: string;
    used: number;
    free: number;
    availableAt?: string;
  };
  if (!result.ok) {
    const availableAt = result.availableAt ? new Date(result.availableAt) : new Date();
    return json(
      {
        error: nextRoundAt(availableAt),
        availableAt: availableAt.toISOString(),
        used: result.used,
        free: result.free,
      },
      429,
    );
  }
  if (result.jobId) await triggerJob(result.jobId);
  return json({ used: result.used, free: result.free });
}
