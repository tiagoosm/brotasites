"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MfaChallenge } from "@/components/account/mfa";
import { Loading, Notice, unavailable } from "@/components/shared/page-state";
import { useRequiredAccount } from "@/lib/account";
import { PLATFORM_URL } from "@/lib/site-url";
import { getBrowserSupabase } from "@/lib/supabase/client";

// The admin panel (E11): only for people the owner listed as admins. The second step (aal2, E15)
// is behind the team's switch (E33, team_settings.require_second_factor, off for now by the
// owner's decision): the database's is_admin() checks the list, the switch and, when it is on,
// aal2. With the switch on, team members without aal2 type the code here; with it off, they go
// straight in and the panel shows a reminder that the second step is off. The pages read through
// the admin route handlers, which check the role again on every request.
// The team's tabs, a second row under the header (E17), only once the person is an admin.
const teamTabs = [
  {
    href: "/admin",
    label: "Fila de revisão",
    match: (path: string) => path === "/admin" || path.startsWith("/admin/sites/"),
  },
  // E42: every published site, with "Fora do ar" and "Exclusão agendada".
  {
    href: "/admin/sites",
    label: "Sites",
    match: (path: string) => path === "/admin/sites",
  },
  {
    href: "/admin/catalogo",
    label: "Catálogo",
    match: (path: string) => path.startsWith("/admin/catalogo"),
  },
  // E24: the numbers, the costs, the accounts and the limits.
  {
    href: "/admin/visao-geral",
    label: "Visão geral",
    match: (path: string) => path.startsWith("/admin/visao-geral"),
  },
  {
    href: "/admin/custos",
    label: "Custos",
    match: (path: string) => path.startsWith("/admin/custos"),
  },
  {
    href: "/admin/contas",
    label: "Contas",
    match: (path: string) => path.startsWith("/admin/contas"),
  },
  {
    href: "/admin/limites",
    label: "Limites",
    match: (path: string) => path.startsWith("/admin/limites"),
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = useRequiredAccount();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [member, setMember] = useState(false);
  // The team's switch (E33); anything but a clear "off" counts as on, as before E33.
  const [secondFactor, setSecondFactor] = useState(true);
  const [checks, setChecks] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: checks re-runs the test after the second step
  useEffect(() => {
    if (account.status !== "signed-in") return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    (async () => {
      const [{ data }, required] = await Promise.all([
        supabase.rpc("is_admin"),
        supabase.rpc("second_factor_required"),
      ]);
      setSecondFactor(Boolean(required.error) || required.data !== false);
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
        {admin && !secondFactor && (
          // Only the team sees this (inside the panel, once is_admin is true): the reminder for
          // the owner to turn the second step back on (docs/owner-steps.md).
          <p
            role="note"
            className="mb-6 rounded-lg border border-pollen/50 bg-pollen/10 px-4 py-3 text-[0.875rem] text-ink"
          >
            <strong className="font-semibold">A verificação em duas etapas está desligada.</strong>{" "}
            Para religar, rode no SQL do Supabase:{" "}
            <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[0.8125rem]">
              update public.team_settings set require_second_factor = true;
            </code>
          </p>
        )}
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
                className="-mb-px inline-flex min-h-11 min-w-11 items-center justify-center border-b-2 border-transparent font-semibold text-leaf-deep aria-[current=page]:border-leaf-deep aria-[current=page]:text-ink"
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
        ) : member && secondFactor ? (
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
            // On the team's host "/" only leads back here: the platform's own address instead.
            action={{ href: PLATFORM_URL, label: "Ir para o site" }}
          />
        )}
      </main>
    </div>
  );
}
