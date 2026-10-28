import { NextResponse } from "next/server";
import { triggerJob } from "@/lib/server/jobs";
import { errors, fail } from "@/lib/server/session";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

// The test payment: confirms a pending stub payment of the person's own site. It exists only
// with PAYMENTS_MODE=stub; real payments are confirmed by the provider's webhook.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.PAYMENTS_MODE !== "stub") return fail(404, errors.notFound);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, errors.notFound);
  const supabase = await getServerSupabase();
  const admin = getAdminSupabase();
  if (!supabase || !admin) return fail(503, errors.unavailable);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail(401, errors.signedOut);
  // RLS: owners read their payments.
  const { data: payment } = await supabase
    .from("payments")
    .select("id, provider, site_id")
    .eq("id", id)
    .maybeSingle();
  if (payment?.provider !== "stub") return fail(404, errors.notFound);

  const { data: jobId, error } = await admin.rpc("server_confirm_payment", {
    p_payment_id: id,
    p_external_id: `stub_${id}`,
  });
  if (error) return fail(409, "Este pagamento não pode mais ser confirmado.");
  if (typeof jobId === "string") await triggerJob(jobId);
  return NextResponse.json({ siteId: payment.site_id });
}
