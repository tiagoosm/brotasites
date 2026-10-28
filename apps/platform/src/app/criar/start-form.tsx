"use client";

import { categoryIds, type FormDraft, formSteps12 } from "@brotasites/schema/v1.2";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loading, Notice, unavailable } from "@/components/shared/page-state";
import { useRequiredAccount } from "@/lib/account";
import { readDemoHandoff } from "@/lib/demo-handoff";
import { createSite, listSites, loadSite } from "@/lib/sites";
import { getBrowserSupabase } from "@/lib/supabase/client";

// "/criar": signing in comes first (docs/form-flow.md). Then the latest draft opens where the
// person stopped, or a new site starts (with the name and type from the home page demo).

export function StartForm() {
  const router = useRouter();
  const params = useSearchParams();
  const account = useRequiredAccount();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (account.status !== "signed-in" || started.current) return;
    started.current = true;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    (async () => {
      const handoff = readDemoHandoff(params.toString(), categoryIds);
      const fresh = params.get("novo") === "1" || Boolean(handoff.name || handoff.type);
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
      const draft: FormDraft =
        handoff.name || handoff.type
          ? { business: { name: handoff.name, category: handoff.type } }
          : {};
      const siteId = await createSite(supabase, draft);
      router.replace(`/criar/${siteId}/negocio`);
    })().catch(() => setFailed(true));
  }, [account.status, params, router]);

  if (account.status === "unavailable") return <Notice {...unavailable} />;
  if (failed) {
    return (
      <Notice
        title="Não foi possível começar"
        text="Algo falhou ao abrir o seu site. Atualize a página para tentar de novo."
        action={{ href: "/meus-sites", label: "Ir para Meus sites" }}
      />
    );
  }
  return <Loading label="Abrindo o seu site…" />;
}
