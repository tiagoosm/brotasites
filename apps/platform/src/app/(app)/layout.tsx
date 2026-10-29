import { headers } from "next/headers";
import { connection } from "next/server";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SkipLink } from "@/components/site/skip-link";
import { headerSession } from "@/lib/server/header-session";

// The signed-in area and the account pages: rendered on each request, so every script carries
// the request's CSP nonce (src/proxy.ts) and nothing personal is ever prerendered or cached.
// The same header and footer as the public pages (E17), with who is signed in read here, on
// the server, so the header's first render is already right.

const FOCUS_SCREENS = ["/entrar", "/cadastro", "/esqueci-senha", "/redefinir-senha"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const [session, path] = await Promise.all([
    headerSession(),
    headers().then((list) => list.get("x-pathname") ?? ""),
  ]);
  const focus = FOCUS_SCREENS.some((screen) => path === screen || path.startsWith(`${screen}/`));
  return (
    <>
      <SkipLink />
      <SiteHeader session={session} />
      <div id="conteudo" tabIndex={-1} className="outline-none">
        {children}
      </div>
      <SiteFooter signedIn={session.signedIn} compact={focus} />
    </>
  );
}
