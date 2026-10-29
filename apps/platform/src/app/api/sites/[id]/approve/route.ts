import { NextResponse } from "next/server";
import { triggerJob } from "@/lib/server/jobs";
import { paymentProvider, publishAmountCents } from "@/lib/server/payments";
import { accountErrors, errors, fail, ownSite } from "@/lib/server/session";
import { getAdminSupabase } from "@/lib/supabase/admin";

const approveErrors: Record<string, [number, string]> = {
  wrong_status: [409, "O site não está pronto para aprovar. Atualize a página."],
  no_subdomain: [409, "Escolha e guarde o endereço do site antes de aprovar."],
  site_not_found: [404, errors.notFound],
  email_not_confirmed: [403, accountErrors.emailNotConfirmed],
};

// The client approves the finished site: a payment to make, or (already paid) publishing.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await ownSite(id);
  if ("error" in owned) return owned.error;
  // Paying needs a confirmed email (checked again by server_approve).
  if (!owned.user.email_confirmed_at) return fail(403, accountErrors.emailNotConfirmed);
  const provider = paymentProvider();
  const admin = getAdminSupabase();
  if (!provider || !admin)
    return fail(503, "Os pagamentos ainda não estão ligados. Tente de novo mais tarde.");

  const { data, error } = await admin.rpc("server_approve", {
    p_site_id: id,
    p_amount_cents: publishAmountCents(),
    p_provider: provider.id,
  });
  if (error) {
    const code = Object.keys(approveErrors).find((key) => error.message?.includes(key));
    const [status, message] = code
      ? (approveErrors[code] as [number, string])
      : [500, errors.unavailable];
    return fail(status, message);
  }
  const result = data as { paymentId?: string; jobId?: string };
  if (result.jobId) {
    await triggerJob(result.jobId);
    return NextResponse.json({ published: true });
  }
  return NextResponse.json({ paymentId: result.paymentId });
}
