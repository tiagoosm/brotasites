"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

// An unexpected error on a signed-in page (Murphy; the public pages are static): say so plainly, keep the person's work
// (answers are saved in the account as they go) and offer to try again or go somewhere safe.
export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="conteudo" className="mx-auto grid max-w-md content-center gap-4 px-5 py-20">
      <h1 className="font-display text-[2.25rem] leading-[1.08]">Algo deu errado</h1>
      <p className="text-[1.0625rem] text-ink-soft">
        Suas respostas continuam salvas. Tente de novo em instantes.
      </p>
      <div className="flex flex-wrap items-center gap-x-7 gap-y-4 pt-2">
        <Button type="button" size="lg" onClick={() => retry()}>
          Tentar de novo
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
  );
}
