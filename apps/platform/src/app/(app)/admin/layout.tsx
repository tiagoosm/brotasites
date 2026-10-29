"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MfaChallenge } from "@/components/account/mfa";
import { Brand } from "@/components/brand";
import { Loading, Notice, unavailable } from "@/components/shared/page-state";
import { useRequiredAccount } from "@/lib/account";
import { getBrowserSupabase } from "@/lib/supabase/client";

// The admin panel (E11): only for people the owner listed as admins, and only in a session with
// the second step (aal2, E15): the database's is_admin() checks both. Team members without it
// turn it on or type the code here. The pages read through the admin route handlers, which
// check the role again on every request.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = useRequiredAccount();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [member, setMember] = useState(false);
  const [checks, setChecks] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: checks re-runs the test after the second step
  useEffect(() => {
    if (account.status !== "signed-in") return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.rpc("is_admin");
      if (data === true) {
        setAdmin(true);
        return;
      }
      const { data: isMember } = await supabase.rpc("is_admin_member");
      setMember(isMember === true);
      setAdmin(false);
    })().catch(() => setAdmin(false));
  }, [account.status, checks]);

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
        ) : member ? (
          <section className="mx-auto grid max-w-md gap-6 py-12">
            <header className="grid gap-3">
              <h1 className="font-display text-[2rem] leading-tight">Verificação em duas etapas</h1>
              <p className="text-[0.9375rem] text-ink-soft">
                A área da equipe exige a verificação em duas etapas a cada entrada.
              </p>
            </header>
            <MfaChallenge
              onDone={async () => {
                await getBrowserSupabase()?.auth.refreshSession();
                setAdmin(null);
                setChecks((count) => count + 1);
              }}
            />
          </section>
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
