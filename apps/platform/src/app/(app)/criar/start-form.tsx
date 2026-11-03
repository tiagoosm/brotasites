"use client";

import { formSteps12 } from "@brotasites/schema/v1.2";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loading, Notice, unavailable } from "@/components/shared/page-state";
import { useRequiredAccount } from "@/lib/account";
import { siteSlotCopy } from "@/lib/limits-copy";
import { createSite, listSites, loadSite, SiteInProgressError } from "@/lib/sites";
import { getBrowserSupabase } from "@/lib/supabase/client";

// "/criar": signing in comes first (docs/form-flow.md). Then the latest draft opens where the
// person stopped, or a new, empty site starts ("?novo=1" always starts a new one).

export function StartForm() {
  const router = useRouter();
  const params = useSearchParams();
  const account = useRequiredAccount();
  const [failed, setFailed] = useState(false);
  // One unpaid site in progress per account (E24): the site to finish or discard first.
  const [blocked, setBlocked] = useState<{ siteId: string | null } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (account.status !== "signed-in" || started.current) return;
    started.current = true;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    (async () => {
      const fresh = params.get("novo") === "1";
      const draftSite = fresh
        ? undefined
        : (await listSites(supabase)).find((site) => site.status === "draft");
      if (draftSite) {
        const loaded = await loadSite(supabase, draftSite.id);
        const next =
          formSteps12.find((step) => !loaded?.completed.includes(step.slug)) ?? formSteps12[0];
        router.replace(`/criar/${draftSite.id}/${next.slug}`);
        return;
      }
      const siteId = await createSite();
      router.replace(`/criar/${siteId}/negocio`);
    })().catch((error) => {
      if (error instanceof SiteInProgressError) setBlocked({ siteId: error.siteId });
      else setFailed(true);
    });
  }, [account.status, params, router]);

  if (account.status === "unavailable") return <Notice {...unavailable} />;
  if (blocked) {
    return (
      <Notice
        title="Você já tem um site em andamento"
        text={siteSlotCopy.blocked}
        action={{
          href: blocked.siteId ? `/meus-sites/${blocked.siteId}` : "/painel",
          label: siteSlotCopy.openSite,
        }}
      />
    );
  }
  if (failed) {
    return (
      <Notice
        title="Não foi possível começar"
        text="Algo falhou ao abrir o seu site. Atualize a página para tentar de novo."
        action={{ href: "/painel", label: "Ir para o painel" }}
      />
    );
  }
  return <Loading label="Abrindo o seu site…" />;
}
