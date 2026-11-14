import { z } from "zod";
import { limits } from "@/config/limits";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { clientIp, guardErrors, json, limitKey, readBody, refuse } from "./guard";
import { rulesFor, withinLimits } from "./rate-limit";
import { ownSite } from "./session";
import { syncHosting, type TakedownAnswer, takedownError } from "./takedown";

// The client's own requests (E42): take their published site offline, put it back, schedule
// its deletion (7 days, typing the address) and cancel it. The database checks it is theirs and
// that the status allows it; the hosting follows the answer. No team approval: the team is told.

export type OwnerAction = "offline" | "online" | "schedule" | "cancel";

// The address is typed only to schedule a deletion.
const confirmation = z
  .object({ confirm: z.literal(true), address: z.string().trim().toLowerCase().max(80).optional() })
  .strict();

export async function ownerTakedown(
  request: Request,
  siteId: string,
  action: OwnerAction,
): Promise<Response> {
  const body = await readBody(request, confirmation);
  if ("error" in body) return body.error;
  const owned = await ownSite(siteId);
  if ("error" in owned && owned.error) return owned.error;
  if (!(await withinLimits(rulesFor("sites", clientIp(request), owned.user.id, limitKey)))) {
    return refuse(429, guardErrors.rateLimited);
  }
  if (action === "schedule") {
    const typed = body.data.address;
    if (!owned.site.subdomain || typed !== owned.site.subdomain) {
      return refuse(400, "O endereço digitado não confere. Digite exatamente o endereço do site.");
    }
  }
  const admin = getAdminSupabase();
  if (!admin) return refuse(503, guardErrors.unavailable);
  const base = { p_site_id: siteId, p_actor: "owner", p_actor_id: owned.user.id };
  const call =
    action === "offline"
      ? admin.rpc("server_take_offline", base)
      : action === "online"
        ? admin.rpc("server_restore_online", base)
        : action === "schedule"
          ? admin.rpc("server_request_deletion", { ...base, p_days: limits.deletionWaitDays })
          : admin.rpc("server_cancel_deletion", base);
  const { data, error } = await call;
  if (error) {
    const [status, message] = takedownError(error.message);
    return refuse(status, message);
  }
  const answer = data as TakedownAnswer;
  // Taking offline (or scheduling, which takes offline) and coming back change what visitors
  // see; cancelling a deletion keeps the site offline.
  const hosting = action === "cancel" ? "none" : await syncHosting(answer);
  return json({
    status: answer.status,
    changed: answer.changed,
    deleteAfter: answer.deleteAfter ?? null,
    hosting,
  });
}

/** What the database answers to a withdrawal (server_withdraw). */
interface WithdrawalAnswer {
  requestId: string;
  requestedAt: string;
  amountCents: number;
  status: "requested" | "refunded";
  changed: boolean;
  subdomain: string | null;
  ownerId: string;
  siteStatus: string;
  deleteAfter: string | null;
}

const withdrawal = z.object({ confirm: z.literal(true) }).strict();

/**
 * E43: the owner withdraws (direito de arrependimento, CDC art. 49) within 7 days of paying.
 * The database checks the window, records the refund request for the full amount, takes the
 * site offline and schedules its deletion; the answer is the immediate confirmation of receipt
 * that Decreto 7.962/2013 art. 5 asks for. The team refunds at the payment provider.
 */
export async function ownerWithdraw(request: Request, siteId: string): Promise<Response> {
  const body = await readBody(request, withdrawal);
  if ("error" in body) return body.error;
  const owned = await ownSite(siteId);
  if ("error" in owned && owned.error) return owned.error;
  if (!(await withinLimits(rulesFor("sites", clientIp(request), owned.user.id, limitKey)))) {
    return refuse(429, guardErrors.rateLimited);
  }
  const admin = getAdminSupabase();
  if (!admin) return refuse(503, guardErrors.unavailable);
  const { data, error } = await admin.rpc("server_withdraw", {
    p_site_id: siteId,
    p_owner_id: owned.user.id,
  });
  if (error) {
    const [status, message] = takedownError(error.message);
    return refuse(status, message);
  }
  const answer = data as WithdrawalAnswer;
  const hosting = answer.changed
    ? await syncHosting({ status: answer.siteStatus, subdomain: answer.subdomain })
    : "none";
  return json({
    requestId: answer.requestId,
    requestedAt: answer.requestedAt,
    amountCents: answer.amountCents,
    status: answer.status,
    deleteAfter: answer.deleteAfter,
    hosting,
  });
}
