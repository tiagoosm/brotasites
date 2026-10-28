import { NextResponse } from "next/server";
import { adminErrors, requireAdmin } from "@/lib/server/admin";
import { fail } from "@/lib/server/session";

// Recommend or retire a composition or a variant, or clear the mark. A recommended composition
// is copied from a direction that has it, never from the request, so only real compositions
// from the catalog can be recommended.
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if ("error" in admin) return admin.error;
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    ref?: unknown;
    state?: unknown;
  } | null;
  const kind = body?.kind === "composition" || body?.kind === "variant" ? body.kind : null;
  const ref = typeof body?.ref === "string" ? body.ref : "";
  const state = body?.state === "recommended" || body?.state === "retired" ? body.state : null;
  const validRef =
    kind === "composition" ? /^[0-9a-f]{16}$/.test(ref) : /^[a-z0-9-]{1,80}$/.test(ref);
  if (!kind || !validRef || (body?.state !== null && !state))
    return fail(400, adminErrors.badRequest);

  if (!state) {
    const { error } = await admin.db
      .from("catalog_weights")
      .delete()
      .eq("kind", kind)
      .eq("ref", ref);
    if (error) return fail(500, error.message);
    return NextResponse.json({ ok: true });
  }
  let choices: Record<string, unknown> | null = null;
  if (kind === "composition") {
    const { data } = await admin.db
      .from("site_directions")
      .select("identity")
      .eq("composition_key", ref)
      .limit(1)
      .maybeSingle();
    if (!data) return fail(404, "Não encontramos essa composição.");
    // The fields of a composition (compositionKey in packages/engine/src/weights.ts).
    const identity = data.identity as Record<string, unknown>;
    choices = {
      personality: identity.personality,
      heroVariant: identity.heroVariant,
      sectionVariants: identity.sectionVariants,
      fontPair: identity.fontPair,
      ornamentSet: identity.ornamentSet,
    };
  }
  const { error } = await admin.db.from("catalog_weights").upsert({
    kind,
    ref,
    state,
    choices: state === "recommended" ? choices : null,
    updated_by: admin.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return fail(500, error.message);
  return NextResponse.json({ ok: true });
}
