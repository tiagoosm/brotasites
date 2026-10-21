"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { fetchMySite, type MySite, siteUrl } from "@/lib/my-site";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// Where the client follows their site after publishing. It refreshes on its own while the
// site is being built, and says plainly when something needs attention.

const POLL_MS = 3000;

type View =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "error" }
  | { state: "none" }
  | { state: "site"; site: MySite };

const stages = [
  { id: "received", label: "Pedido recebido" },
  { id: "generating", label: "Montando o seu site" },
  { id: "publishing", label: "Colocando no ar" },
  { id: "live", label: "No ar" },
] as const;

function currentStage(status: MySite["status"]): number {
  switch (status) {
    case "generating":
      return 1;
    case "publishing":
      return 2;
    case "live":
      return 3;
    default:
      return 0;
  }
}

export function SiteStatus() {
  const [view, setView] = useState<View>({ state: "loading" });
  const busy =
    view.state === "site" &&
    (view.site.status === "generating" || view.site.status === "publishing");

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setView({ state: "error" });
      return;
    }
    let cancelled = false;
    async function load() {
      if (!supabase) return;
      const { data } = await supabase.auth.getClaims();
      if (cancelled) return;
      if (!data?.claims) {
        setView({ state: "signed-out" });
        return;
      }
      try {
        const site = await fetchMySite(supabase);
        if (!cancelled) setView(site ? { state: "site", site } : { state: "none" });
      } catch {
        if (!cancelled) setView({ state: "error" });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Follow the build while it runs.
  useEffect(() => {
    if (!busy) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const timer = setInterval(() => {
      fetchMySite(supabase)
        .then((site) => site && setView({ state: "site", site }))
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [busy]);

  return (
    <div className="step-enter mx-auto grid w-full max-w-[34rem] gap-14">
      <Brand className="justify-self-start" />
      {view.state === "loading" && <p className="text-ink-soft">Abrindo o seu site…</p>}
      {view.state === "signed-out" && (
        <Message
          title="Entre para ver o seu site"
          text="O acompanhamento fica na sua conta."
          action={{ href: `/entrar?voltar=${encodeURIComponent("/meu-site")}`, label: "Entrar" }}
        />
      )}
      {view.state === "error" && (
        <Message
          title="Não foi possível abrir agora"
          text="Suas respostas continuam salvas. Tente de novo em instantes."
        />
      )}
      {view.state === "none" && (
        <Message
          title="Você ainda não publicou"
          text="Responda as sete perguntas e publique na última."
          action={{ href: "/criar/negocio", label: "Continuar respondendo" }}
        />
      )}
      {view.state === "site" && <SiteView site={view.site} />}
    </div>
  );
}

function SiteView({ site }: { site: MySite }) {
  const url = site.subdomain ? siteUrl(site.subdomain) : null;
  const address = url?.replace(/^https:\/\//, "");

  if (site.status === "draft") {
    return (
      <Message
        title="Você ainda não publicou"
        text="Responda as sete perguntas e publique na última."
        action={{ href: "/criar/endereco", label: "Ir para a publicação" }}
      />
    );
  }
  if (site.status === "failed") {
    return (
      <Message
        title="Não conseguimos gerar o seu site"
        text="Nada foi publicado e suas respostas continuam salvas. Confira a revisão e tente de novo."
        action={{ href: "/criar/endereco", label: "Revisar e tentar de novo" }}
        tone="problem"
      />
    );
  }
  if (site.status === "in_review") {
    return (
      <Message
        title="O seu site está em revisão"
        text="Algumas respostas precisam de uma conferência antes de publicar. Avisamos por e-mail assim que estiver no ar."
      />
    );
  }

  const stage = currentStage(site.status);
  const live = site.status === "live";
  return (
    <section aria-labelledby="status-title" className="grid gap-10">
      <header className="grid gap-3">
        <p className="tag text-stem">{address}</p>
        <h1
          id="status-title"
          className="font-display text-[2.5rem] leading-[1.05] sm:text-[2.875rem]"
        >
          {live ? "O seu site está no ar" : "O seu site está brotando"}
        </h1>
        <p className="text-[1.0625rem] text-ink-soft">
          {live
            ? "Compartilhe o endereço com os seus clientes. Para mudar algo, é só editar as respostas."
            : "Leva alguns minutos. Pode fechar esta página: o site continua sendo preparado."}
        </p>
      </header>

      <ol className="relative grid gap-7" aria-label="Etapas da publicação">
        <span
          aria-hidden="true"
          className="absolute top-2 bottom-2 left-[0.4375rem] w-px bg-line-strong"
        />
        {stages.map((item, index) => {
          const done = index < stage || live;
          const current = index === stage && !live;
          return (
            <li
              key={item.id}
              aria-current={current ? "step" : undefined}
              className={cn(
                "relative flex items-center gap-4 pl-0",
                !done && !current && "text-ink-soft",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative size-[0.9375rem] shrink-0 rounded-full border-2",
                  done && "border-leaf bg-leaf",
                  current && "live-dot border-pollen bg-pollen",
                  !done && !current && "border-line-strong bg-paper",
                )}
              />
              <span className={cn("text-[1.0625rem]", (done || current) && "font-semibold")}>
                {item.label}
              </span>
              <span className="sr-only">
                {done ? "(concluída)" : current ? "(em andamento)" : "(a seguir)"}
              </span>
            </li>
          );
        })}
      </ol>

      {live && url && (
        <Button asChild size="lg" className="justify-self-start">
          <a href={url} target="_blank" rel="noopener">
            Abrir o meu site
            <ArrowUpRight aria-hidden="true" />
          </a>
        </Button>
      )}
    </section>
  );
}

function Message({
  title,
  text,
  action,
  tone = "default",
}: {
  title: string;
  text: string;
  action?: { href: string; label: string };
  tone?: "default" | "problem";
}) {
  return (
    <section className="grid gap-4">
      <h1
        className={cn(
          "font-display text-[2.5rem] leading-[1.05]",
          tone === "problem" && "text-ink",
        )}
      >
        {title}
      </h1>
      <p className="text-[1.0625rem] text-ink-soft">{text}</p>
      {action && (
        <Button asChild size="lg" className="mt-2 justify-self-start">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </section>
  );
}
