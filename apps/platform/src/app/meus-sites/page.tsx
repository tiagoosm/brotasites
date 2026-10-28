"use client";

import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loading, Notice } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { infoFor } from "@/lib/site-status";
import { listSites, type SiteRow } from "@/lib/sites";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const POLL_MS = 5000;

export default function MySitesPage() {
  const [sites, setSites] = useState<(SiteRow & { name?: string })[] | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = sites?.some((site) => infoFor(site.status).busy) ?? false;

  useEffect(() => {
    document.title = "Meus sites · BrotaSites";
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const load = () =>
      listSites(supabase)
        .then(setSites)
        .catch(() => setFailed(true));
    void load();
    if (!busy) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [busy]);

  if (failed && !sites) {
    return (
      <Notice
        title="Não foi possível abrir agora"
        text="Suas respostas continuam salvas. Tente de novo em instantes."
      />
    );
  }
  if (!sites) return <Loading />;

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[2.5rem] leading-[1.05]">Meus sites</h1>
        <Button asChild variant="outline">
          <Link href="/criar?novo=1">
            <Plus aria-hidden="true" />
            Criar outro site
          </Link>
        </Button>
      </div>
      {sites.length === 0 ? (
        <Notice
          title="Você ainda não tem sites"
          text="Responda as perguntas e veja 3 direções para o visual do seu site."
          action={{ href: "/criar", label: "Começar meu site" }}
        />
      ) : (
        <ul className="grid gap-3">
          {sites.map((site) => {
            const info = infoFor(site.status);
            return (
              <li key={site.id}>
                <Link
                  href={`/meus-sites/${site.id}`}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-input bg-card p-5 transition-colors hover:border-leaf"
                >
                  <div className="grid min-w-0 gap-1">
                    <span className="truncate text-[1.125rem] font-semibold">
                      {site.name || "Site sem nome"}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 rounded-full",
                          info.yourTurn
                            ? "bg-pollen"
                            : info.busy
                              ? "live-dot bg-leaf"
                              : "bg-line-strong",
                        )}
                      />
                      {info.label}
                      {info.yourTurn && <span className="tag text-stem">Sua vez</span>}
                    </span>
                  </div>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-5 text-ink-soft transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
