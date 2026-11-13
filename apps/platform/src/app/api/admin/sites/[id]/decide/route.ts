import { NextResponse } from "next/server";
import { adminErrors, isUuid, requireAdmin } from "@/lib/server/admin";
import { setHostingState } from "@/lib/server/hosting";
import { triggerJob } from "@/lib/server/jobs";
import { errors, fail } from "@/lib/server/session";
import {
  cleanUpDeletedSite,
  type DeletedAnswer,
  syncHosting,
  type TakedownAnswer,
  takedownError,
} from "@/lib/server/takedown";

const actions = ["approve", "request_changes", "suspend", "unsuspend"] as const;
/** E42: taking a site offline and deleting it, with a reason from the list and a note. */
const takedownActions = [
  "take_offline",
  "restore_online",
  "schedule_deletion",
  "cancel_deletion",
  "delete_now",
] as const;
const reasons = ["admin", "abuse", "legal", "terms", "payment", "other"] as const;

const decideErrors: Record<string, [number, string]> = {
  wrong_status: [409, "O site não está num estado que permita isso. Atualize a página."],
  note_required: [400, "Escreva o motivo: o cliente e o registro precisam dele."],
  site_not_found: [404, errors.notFound],
  not_admin: [403, adminErrors.forbidden],
};

interface Body {
  action?: unknown;
  note?: unknown;
  reason?: unknown;
  /** take_offline: show the note to the client. */
  public?: unknown;
  /** schedule_deletion: 0 to 30 days (7 by default). */
  days?: unknown;
  /** delete_now: the site's address, typed to confirm. */
  address?: unknown;
}

/** E42: the team's take-offline and deletion, through the same functions the client uses. */
async function decideTakedown(
  siteId: string,
  admin: { userId: string; db: import("@supabase/supabase-js").SupabaseClient },
  action: (typeof takedownActions)[number],
  note: string,
  body: Body,
) {
  const base = { p_site_id: siteId, p_actor: "admin", p_actor_id: admin.userId };
  const reason = reasons.find((item) => item === body.reason) ?? null;
  if (action === "delete_now") {
    const { data: site } = await admin.db
      .from("sites")
      .select("subdomain")
      .eq("id", siteId)
      .maybeSingle();
    const typed = typeof body.address === "string" ? body.address.trim().toLowerCase() : "";
    if (site && (site.subdomain ?? "") !== typed) {
      return fail(400, "O endereço digitado não confere. Digite exatamente o endereço do site.");
    }
    const { data, error } = await admin.db.rpc("server_delete_site_now", { ...base, p_note: note });
    if (error) {
      const [status, message] = takedownError(error.message);
      return fail(status, message);
    }
    await cleanUpDeletedSite(admin.db, data as DeletedAnswer);
    return NextResponse.json({ status: "deleted" });
  }
  const days = typeof body.days === "number" && Number.isInteger(body.days) ? body.days : 7;
  const { data, error } =
    action === "take_offline"
      ? await admin.db.rpc("server_take_offline", {
          ...base,
          p_reason: reason,
          p_note: note,
          p_public: body.public === true,
        })
      : action === "restore_online"
        ? await admin.db.rpc("server_restore_online", { ...base, p_note: note })
        : action === "schedule_deletion"
          ? await admin.db.rpc("server_request_deletion", {
              ...base,
              p_days: days,
              p_reason: reason,
              p_note: note,
            })
          : await admin.db.rpc("server_cancel_deletion", base);
  if (error) {
    const [status, message] = takedownError(error.message);
    return fail(status, message);
  }
  const answer = data as TakedownAnswer;
  const hosting = action === "cancel_deletion" ? "none" : await syncHosting(answer);
  return NextResponse.json({ status: answer.status, changed: answer.changed, hosting });
}

// An admin's decision on a site, logged with who made it (server_admin_decide).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail(404, errors.notFound);
  const admin = await requireAdmin(request);
  if ("error" in admin) return admin.error;
  const body = (await request.json().catch(() => null)) as Body | null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";
  const takedown = takedownActions.find((item) => item === body?.action);
  if (takedown) return decideTakedown(id, admin, takedown, note, body ?? {});
  const action = actions.find((item) => item === body?.action);
  if (!action) return fail(400, adminErrors.badRequest);

  const { data, error } = await admin.db.rpc("server_admin_decide", {
    p_site_id: id,
    p_admin_id: admin.userId,
    p_action: action,
    p_note: note || null,
  });
  if (error) {
    const code = Object.keys(decideErrors).find((key) => error.message?.includes(key));
    const [status, message] = code
      ? (decideErrors[code] as [number, string])
      : [500, errors.unavailable];
    return fail(status, message);
  }
  const result = data as { status: string; jobId?: string };
  if (result.jobId) await triggerJob(result.jobId);
  // A published site follows the decision on the sites Worker (KV), within about a minute.
  let hosting: "synced" | "not-published" | "off" | "failed" | undefined;
  if (action === "suspend" || action === "unsuspend") {
    const { data: site } = await admin.db
      .from("sites")
      .select("subdomain")
      .eq("id", id)
      .maybeSingle();
    if (site?.subdomain) {
      const state =
        action === "suspend" ? "suspended" : result.status === "grace" ? "grace" : "active";
      hosting = await setHostingState(site.subdomain as string, state).catch(
        () => "failed" as const,
      );
    }
  }
  return NextResponse.json({ status: result.status, hosting });
}
