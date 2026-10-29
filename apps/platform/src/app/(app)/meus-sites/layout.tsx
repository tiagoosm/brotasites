"use client";

import Link from "next/link";
import { Brand } from "@/components/brand";
import { Loading, Notice, unavailable } from "@/components/shared/page-state";
import { useRequiredAccount } from "@/lib/account";

// "Meus sites": the client's dashboard (docs/product.md). Signing in is required.
export default function MySitesLayout({ children }: { children: React.ReactNode }) {
  const account = useRequiredAccount();
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex w-full max-w-[60rem] items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Brand />
        {account.status === "signed-in" && (
          <div className="flex items-center gap-5 text-[0.8125rem] text-ink-soft">
            <Link
              href="/meus-sites"
              className="touch-target font-semibold text-leaf-deep underline-offset-4 hover:underline"
            >
              Meus sites
            </Link>
            <form action="/auth/sair" method="post">
              <input type="hidden" name="voltar" value="/" />
              <button
                type="submit"
                className="touch-target font-semibold text-leaf-deep underline-offset-4 hover:underline"
              >
                Sair
              </button>
            </form>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-[60rem] px-5 pb-20 sm:px-8">
        {account.status === "unavailable" ? (
          <Notice {...unavailable} />
        ) : account.status === "signed-in" ? (
          children
        ) : (
          <Loading />
        )}
      </main>
    </div>
  );
}
