"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MfaChallenge } from "@/components/account/mfa";
import { Loading, Notice, unavailable } from "@/components/shared/page-state";
import { useRequiredAccount } from "@/lib/account";
import { getBrowserSupabase } from "@/lib/supabase/client";

// The admin panel (E11): only for people the owner listed as admins, and only in a session with
// the second step (aal2, E15): the database's is_admin() checks both. Team members without it
// turn it on or type the code here. The pages read through the admin route handlers, which
// check the role again on every request.
// The team's tabs, a second row under the header (E17), only once the person is an admin.
const teamTabs = [
  {
    href: "/admin",
    label: "Fila de revisão",
    match: (path: string) => path === "/admin" || path.startsWith("/admin/sites"),
  },
  {
    href: "/admin/catalogo",
    label: "Catálogo",
    match: (path: string) => path.startsWith("/admin/catalogo"),
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = useRequiredAccount();
  const pathname = usePathname();
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
    <div className="min-h-[calc(100dvh-4rem)] bg-paper">
      <main className="mx-auto w-full max-w-[72rem] px-5 pt-6 pb-20 sm:px-8">
        {admin && (
          <nav
            aria-label="Área da equipe"
            className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line text-[0.9375rem]"
          >
            <span className="tag text-stem">Equipe</span>
            {teamTabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.match(pathname) ? "page" : undefined}
                className="-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent font-semibold text-leaf-deep aria-[current=page]:border-leaf-deep aria-[current=page]:text-ink"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}
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
