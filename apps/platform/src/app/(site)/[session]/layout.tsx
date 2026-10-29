import { MotionReveal } from "@/components/site/motion-reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SiteVine } from "@/components/site/site-vine";
import { PUBLIC_VARIANTS, type PublicVariant } from "@/lib/public-variant";

// The public site around the form: home, help and the legal pages. Each page is prerendered
// twice, for visitors and for signed-in people (only the header's menu differs); the proxy
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
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader signedIn={signedIn} />
      <main id="conteudo" className="bg-paper">
        {children}
      </main>
      <SiteFooter signedIn={signedIn} />
      <SiteVine />
      <MotionReveal />
    </>
  );
}
