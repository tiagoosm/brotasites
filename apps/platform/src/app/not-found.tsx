import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

// Any address the platform does not have (Murphy: a dead end that still offers a way on).
// Next.js answers 404 and adds noindex.
export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
          <Brand />
        </div>
      </header>
      <main id="conteudo" className="mx-auto grid max-w-md content-center gap-4 px-5 py-16">
        <p className="tag text-stem">Erro 404</p>
        <h1 className="font-display text-[2.25rem] leading-[1.08]">Página não encontrada</h1>
        <p className="text-[1.0625rem] text-ink-soft">
          O endereço pode ter mudado ou estar incompleto.
        </p>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-4 pt-2">
          <Button asChild size="lg">
            <Link href="/">Ir para o início</Link>
          </Button>
          <Link
            href="/meus-sites"
            prefetch={false}
            className="touch-target text-[0.9375rem] font-semibold text-leaf-deep underline underline-offset-4"
          >
            Ir para Meus sites
          </Link>
        </div>
      </main>
    </div>
  );
}
