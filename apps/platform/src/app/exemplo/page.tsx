import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CREATE_HREF } from "@/components/site/nav";

export const metadata: Metadata = {
  title: "Site de exemplo",
  description:
    "Veja um site feito com o BrotaSites: a Padaria do Zé, um negócio fictício, montada com as sete perguntas.",
  alternates: { canonical: "/exemplo" },
};

// The example site (Padaria do Zé, a made-up business) built by the real generator at build
// time (scripts/build-example.mjs), shown full screen under a slim bar to go back.
export default function ExamplePage() {
  return (
    <div className="flex h-dvh flex-col bg-paper">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="touch-target inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-leaf-deep"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar
        </Link>
        <h1 className="order-last w-full font-sans text-[0.8125rem] font-normal tracking-normal text-ink-soft sm:order-none sm:w-auto sm:flex-1">
          Site de exemplo: a Padaria do Zé é fictícia, mas o site foi feito pelo BrotaSites.
        </h1>
        <Link
          href={CREATE_HREF}
          prefetch={false}
          className="touch-target ml-auto text-[0.9375rem] font-semibold text-leaf-deep underline-offset-4 hover:underline sm:ml-0"
        >
          Criar o meu
        </Link>
      </header>
      <iframe
        src="/exemplo-site/index.html"
        title="Site de exemplo da Padaria do Zé"
        className="min-h-0 w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
