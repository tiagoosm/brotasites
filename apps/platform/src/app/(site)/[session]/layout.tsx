import { AnchorScroll } from "@/components/site/anchor-scroll";
import { MotionReveal } from "@/components/site/motion-reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SiteVine } from "@/components/site/site-vine";
import { SkipLink } from "@/components/site/skip-link";
import { PUBLIC_VARIANTS, type PublicVariant } from "@/lib/public-variant";

// The public site around the form: home, help and the legal pages. Each page is prerendered
// twice, for visitors and for signed-in people (only the header's account part differs); the proxy
// serves the right one under the page's own address (lib/public-variant.ts), so the pages
// stay static and the menu never flickers.
export const dynamicParams = false;

export function generateStaticParams() {
  return PUBLIC_VARIANTS.map((session) => ({ session }));
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ session: string }>;
}) {
  const signedIn = ((await params).session as PublicVariant) === "logado";
  return (
    <>
      <SkipLink />
      <SiteHeader session={signedIn ? { signedIn: true, known: false } : { signedIn: false }} />
      <main id="conteudo" className="bg-paper">
        {children}
      </main>
      <SiteFooter signedIn={signedIn} />
      <SiteVine />
      <MotionReveal />
      <AnchorScroll />
    </>
  );
}
