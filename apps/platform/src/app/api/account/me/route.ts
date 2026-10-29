import { json, refuse } from "@/lib/server/guard";
import { whoIsSignedIn } from "@/lib/server/header-session";
import { errors } from "@/lib/server/session";

// The profile menu on the prerendered public pages (E17) asks who is signed in: the name, the
// email and whether to show "Área da equipe", only to the person themselves (their session).
// Never cached (no-store, from the proxy and here).
export async function GET() {
  const who = await whoIsSignedIn().catch(() => null);
  if (!who) return refuse(401, errors.signedOut);
  return json(who);
}
