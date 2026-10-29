"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { Loading, Notice, unavailable } from "@/components/shared/page-state";
import { useRequiredAccount } from "@/lib/account";
import { getBrowserSupabase } from "@/lib/supabase/client";

// The admin panel (E11): only for people the owner listed as admins. The pages read through the
// admin route handlers, which check the role again on every request.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = useRequiredAccount();
  const [admin, setAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (account.status !== "signed-in") return;
    const supabase = getBrowserSupabase();
    supabase?.rpc("is_admin").then(
      ({ data }) => setAdmin(data === true),
      () => setAdmin(false),
    );
  }, [account.status]);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex w-full max-w-[72rem] flex-wrap items-center justify-between gap-x-4 gap-y-6 px-5 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <Brand href="/admin" />
          <span className="tag text-stem">Equipe</span>
        </div>
        {admin && (
          <nav aria-label="Painel" className="flex items-center gap-5 text-[0.9375rem]">
            <Link
              href="/admin"
              className="touch-target font-semibold text-leaf-deep underline-offset-4 hover:underline"
            >
              Fila de revisão
            </Link>
            <Link
              href="/admin/catalogo"
              className="touch-target font-semibold text-leaf-deep underline-offset-4 hover:underline"
            >
              Catálogo
            </Link>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-[72rem] px-5 pb-20 sm:px-8">
        {account.status === "unavailable" ? (
          <Notice {...unavailable} />
        ) : account.status !== "signed-in" || admin === null ? (
          <Loading />
        ) : admin ? (
          children
        ) : (
          <Notice
            title="Acesso restrito"
            text="Esta área é só para a equipe da BrotaSites."
            action={{ href: "/", label: "Voltar para o início" }}
          />
        )}
      </main>
    </div>
  );
}
