import { z } from "zod";
import { json, readBody } from "@/lib/server/guard";
import { currentUser } from "@/lib/server/session";

// "Sair de todos os dispositivos": every session of the account, this one included.
export async function POST(request: Request) {
  const body = await readBody(request, z.object({ scope: z.enum(["global", "others"]) }));
  if ("error" in body) return body.error;
  const session = await currentUser();
  if ("error" in session) return session.error;
  await session.supabase.auth.signOut({ scope: body.data.scope });
  return json({ ok: true });
}
