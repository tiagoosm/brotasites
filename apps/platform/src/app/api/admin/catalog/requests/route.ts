import { families, sectionIds } from "@brotasites/schema/v1.2";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";
import { fail } from "@/lib/server/session";

// A request to the variant factory (E6): a person designs, tests and approves every new variant.
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if ("error" in admin) return admin.error;
  const body = (await request.json().catch(() => null)) as {
    family?: unknown;
    section?: unknown;
    note?: unknown;
  } | null;
  const family = families.find((item) => item === body?.family);
  const section = sectionIds.find((item) => item === body?.section);
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!family || !section || note.length < 10 || note.length > 1000) {
    return fail(400, "Escolha a família e a seção e descreva a variante (10 a 1000 caracteres).");
  }
  const { error } = await admin.db
    .from("variant_requests")
    .insert({ family, section, note, requested_by: admin.userId });
  if (error) return fail(500, error.message);
  return NextResponse.json({ ok: true });
}
