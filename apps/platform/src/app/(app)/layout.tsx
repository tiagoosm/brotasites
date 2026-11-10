import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { AnchorScroll } from "@/components/site/anchor-scroll";
import { type HeaderSession, isAccountScreen } from "@/components/site/nav";
import { NavigationProgress } from "@/components/site/navigation-progress";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SkipLink } from "@/components/site/skip-link";
import { headerSession } from "@/lib/server/header-session";

// The signed-in area and the account pages: rendered on each request, so every script carries
// the request's CSP nonce (src/proxy.ts) and nothing personal is ever prerendered or cached.
// The same header and footer as the public pages (E17), with who is signed in read here, on
// the server, so the header's right side is right from its first render.
//
// The shell never waits (E26, Doherty): the header's brand and middle links, the page's own
// waiting screen (each segment's loading.tsx) and the footer (no account link since E29) stream
// at once; only the account side (the sign-in link, or "Criar meu site" and the profile button)
// waits for the session, behind a placeholder of a fixed width, so nothing moves when it arrives.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const path = (await headers()).get("x-pathname") ?? "";
  const focus = isAccountScreen(path);
  // Started now, read inside the boundaries below: the page renders meanwhile.
  const session = headerSession();
  return (
    <>
      <NavigationProgress />
      <SkipLink />
      <Suspense fallback={<SiteHeader session={{ signedIn: false }} pending />}>
        <SessionHeader session={session} />
      </Suspense>
      <div id="conteudo" tabIndex={-1} className="outline-none">
        {children}
      </div>
      {/* The account screens have no footer (E30): their own links (the terms in the sign-up
          sentence) and every other page's footer carry the Terms and the Privacy Policy. */}
      {!focus && <SiteFooter />}
      <AnchorScroll />
    </>
  );
}

async function SessionHeader({ session }: { session: Promise<HeaderSession> }) {
  return <SiteHeader session={await session} />;
}
