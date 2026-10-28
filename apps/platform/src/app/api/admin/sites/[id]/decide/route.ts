import { NextResponse } from "next/server";
import { adminErrors, isUuid, requireAdmin } from "@/lib/server/admin";
import { triggerJob } from "@/lib/server/jobs";
import { errors, fail } from "@/lib/server/session";

const actions = ["approve", "request_changes", "suspend", "unsuspend"] as const;

const decideErrors: Record<string, [number, string]> = {
  wrong_status: [409, "O site não está num estado que permita isso. Atualize a página."],
  note_required: [400, "Escreva o motivo: o cliente e o registro precisam dele."],
  site_not_found: [404, errors.notFound],
  not_admin: [403, adminErrors.forbidden],
};

// An admin's decision on a site, logged with who made it (server_admin_decide).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return fail(404, errors.notFound);
  const admin = await requireAdmin(request);
  if ("error" in admin) return admin.error;
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    note?: unknown;
  } | null;
  const action = actions.find((item) => item === body?.action);
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";
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
  return NextResponse.json({ status: result.status });
}
