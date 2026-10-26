import { MotionReveal } from "@/components/site/motion-reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SiteVine } from "@/components/site/site-vine";

// The public site around the form: home, help and the legal pages.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo" className="bg-paper">
        {children}
      </main>
      <SiteFooter />
      <SiteVine />
      <MotionReveal />
    </>
  );
}
