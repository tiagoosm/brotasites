"use client";

import { ArrowRight, ExternalLink, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loading, Notice } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { pricing } from "@/config/pricing";
import { infoFor } from "@/lib/site-status";
import { SITES_DOMAIN } from "@/lib/site-url";
import {
  approveSite,
  chooseDirection,
  type DirectionRow,
  directionLabels,
  type EventRow,
  loadDirections,
  loadEvents,
  loadSite,
  previewUrl,
  renderUrls,
  requestDirections,
  requestRebuild,
  SiteActionError,
  type SiteWithDraft,
} from "@/lib/sites";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// One site of the dashboard: where it is, what the client can do now, and what happened. It
// refreshes on its own while the system works; nothing here waits on a loading screen.

const POLL_MS = 4000;

const directionNotes: Record<DirectionRow["direction"], string> = {
  "fiel-a-marca": "Segue de perto as suas cores e o seu jeito.",
  evolucao: "Parte da sua marca e dá um passo além.",
  contraste: "Um caminho diferente, para comparar.",
};

interface View {
  site: SiteWithDraft;
  directions: DirectionRow[];
  events: EventRow[];
  renders: Record<string, string>;
}

export function SiteDashboard({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [view, setView] = useState<View | null | "missing" | "failed">(null);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    try {
      const site = await loadSite(supabase, siteId);
      if (!site) {
        setView("missing");
        return;
      }
      const choosing = site.status === "awaiting_direction_choice";
      const [events, directions, renders] = await Promise.all([
        loadEvents(supabase, siteId),
        choosing ? loadDirections(supabase, siteId, site.round) : Promise.resolve([]),
        choosing ? renderUrls(siteId) : Promise.resolve({}),
      ]);
      setView((current) => ({
        site,
        events,
        directions,
        // Keep addresses already signed, so the images do not flash on each refresh.
        renders: { ...(typeof current === "object" && current ? current.renders : {}), ...renders },
      }));
    } catch {
      setView((current) => (typeof current === "object" && current ? current : "failed"));
    }
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const busy = typeof view === "object" && view !== null && infoFor(view.site.status).busy;
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [busy, load]);

  async function act(name: string, run: () => Promise<void>) {
    setActing(name);
    setError(null);
    try {
      await run();
      await load();
    } catch (caught) {
      setError(
        caught instanceof SiteActionError
          ? caught.message
          : "Não foi possível fazer isso agora. Tente de novo.",
      );
    }
    setActing(null);
  }

  if (view === null) return <Loading />;
  if (view === "missing") {
    return (
      <Notice
        title="Site não encontrado"
        text="Este site não está na sua conta. Confira se entrou com o mesmo e-mail."
        action={{ href: "/painel", label: "Ir para o painel" }}
      />
    );
  }
  if (view === "failed")
    return <Notice title="Não foi possível abrir agora" text="Tente de novo em instantes." />;

  const { site, directions, events, renders } = view;
  const supabase = getBrowserSupabase();
  const info = infoFor(site.status);
  const name = site.draft.business?.name || "Site sem nome";
  const preview = previewUrl(site);
  const locked = Boolean(site.approved_direction);
  const liveUrl = site.subdomain ? `https://${site.subdomain}.${SITES_DOMAIN}` : null;

  return (
    <div className="grid gap-12">
      <header className="grid gap-3">
        <Link
          href="/painel"
          className="touch-target justify-self-start text-sm font-semibold text-leaf-deep underline-offset-4 hover:underline"
        >
          ← Painel
        </Link>
        <h1 className="font-display text-[2.5rem] leading-[1.05] sm:text-[2.875rem]">{name}</h1>
        <div role="status" className="grid gap-1">
          <p className="flex items-center gap-2 text-[1.0625rem] font-semibold">
            {info.busy && (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-leaf" />
            )}
            {info.label}
          </p>
          <p className="text-[1.0625rem] text-ink-soft">{site.status_message || info.text}</p>
        </div>
      </header>

      {error && (
        <p role="alert" className="text-[0.9375rem] font-semibold text-destructive">
          {error}
        </p>
      )}

      {site.status === "draft" && (
        <Button asChild size="lg" className="justify-self-start">
          <Link href={`/criar/${site.id}/negocio`}>
            Continuar respondendo
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      )}

      {site.status === "awaiting_direction_choice" && (
        <section aria-labelledby="direcoes" className="grid gap-6">
          <div className="grid gap-2">
            <h2 id="direcoes" className="font-display text-[1.75rem] leading-tight">
              Escolha uma das 3
            </h2>
            <p className="text-[0.9375rem] text-ink-soft">
              Escolher uma direção fixa a identidade do site (cores, letras e formas). Depois, ainda
              dá para mudar textos, fotos, contato e seções.
            </p>
          </div>
          <ul className="grid gap-5 md:grid-cols-3">
            {directions.map((direction) => (
              <DirectionCard
                key={direction.id}
                direction={direction}
                renders={renders}
                busy={acting !== null}
                choosing={acting === direction.id}
                onChoose={() =>
                  act(direction.id, async () => {
                    if (supabase) await chooseDirection(supabase, site.id, direction.id);
                  })
                }
              />
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button
              variant="outline"
              size="lg"
              disabled={acting !== null}
              onClick={() =>
                act("redo", async () => {
                  if (supabase) await requestDirections(supabase, site.id);
                })
              }
            >
              {acting === "redo" ? "Pedindo…" : "Nenhuma serviu: criar outras 3"}
            </Button>
            <Link
              href={`/criar/${site.id}/marca`}
              className="touch-target text-sm font-semibold text-leaf-deep underline underline-offset-4"
            >
              Mudar cores ou sensação antes
            </Link>
          </div>
        </section>
      )}

      {preview && ["awaiting_approval", "publishing", "live"].includes(site.status) && (
        <section
          aria-labelledby="site-pronto"
          className="grid gap-4 rounded-xl border border-input bg-card p-6"
        >
          <h2 id="site-pronto" className="font-display text-[1.75rem] leading-tight">
            Site pronto
          </h2>
          <p className="text-[0.9375rem] text-ink-soft">
            Um endereço particular, só para você conferir. Ele não aparece no Google.
          </p>
          <a
            href={preview}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 justify-self-start font-semibold text-leaf-deep underline underline-offset-4"
          >
            Ver o site pronto
            <ExternalLink aria-hidden="true" className="size-4" />
            <span className="sr-only">(abre em outra aba)</span>
          </a>
          {site.status === "awaiting_approval" && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {site.subdomain ? (
                <Button
                  size="lg"
                  disabled={acting !== null}
                  onClick={() =>
                    act("approve", async () => {
                      const result = await approveSite(site.id);
                      if (result.paymentId)
                        router.push(`/meus-sites/${site.id}/pagamento?p=${result.paymentId}`);
                    })
                  }
                >
                  {acting === "approve" ? "Aprovando…" : "Aprovar e publicar"}
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link href={`/criar/${site.id}/endereco`}>Escolher o endereço e aprovar</Link>
                </Button>
              )}
            </div>
          )}
        </section>
      )}

      {["live", "grace"].includes(site.status) && (
        <div id="baixar" className="grid scroll-mt-6 gap-2">
          <Button
            variant="outline"
            size="lg"
            className="justify-self-start"
            disabled={acting !== null}
            onClick={() =>
              act("export", async () => {
                const response = await fetch(`/api/sites/${site.id}/export`);
                const body = (await response.json().catch(() => ({}))) as {
                  url?: string;
                  error?: string;
                };
                if (!response.ok || !body.url) {
                  throw new SiteActionError(body.error ?? "O download não está disponível agora.");
                }
                window.location.assign(body.url);
              })
            }
          >
            Baixar o site (.zip)
          </Button>
          <p className="text-sm text-ink-soft">
            O site é seu: uma cópia com todos os arquivos, para guardar ou hospedar onde quiser.
          </p>
        </div>
      )}

      {site.status === "live" && liveUrl && (
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 justify-self-start text-[1.0625rem] font-semibold text-leaf-deep underline underline-offset-4"
        >
          {liveUrl.replace("https://", "")}
          <ExternalLink aria-hidden="true" className="size-4" />
          <span className="sr-only">(abre em outra aba)</span>
        </a>
      )}

      {locked && ["awaiting_approval", "needs_attention", "live"].includes(site.status) && (
        <section aria-labelledby="ajustes" className="grid gap-4">
          <h2 id="ajustes" className="font-display text-[1.75rem] leading-tight">
            Pedir ajustes
          </h2>
          <p className="text-[0.9375rem] text-ink-soft">
            Mude o que quiser nas respostas e peça uma nova versão. A identidade aprovada continua a
            mesma.
            {site.status === "live" &&
              ` Ajustes incluídos por ${pricing.adjustmentsDays} dias depois de publicar.`}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
            {[
              ["conteudo", "Textos, serviços e fotos"],
              ["contato", "Contato e horários"],
              ["secoes", "Seções"],
              ["negocio", "Sobre o negócio"],
            ].map(([slug, label]) => (
              <Link
                key={slug}
                href={`/criar/${site.id}/${slug}`}
                className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
              >
                {label}
              </Link>
            ))}
          </div>
          <Button
            variant="outline"
            size="lg"
            className="justify-self-start"
            disabled={acting !== null}
            onClick={() =>
              act("rebuild", async () => {
                if (supabase) await requestRebuild(supabase, site.id);
              })
            }
          >
            {acting === "rebuild" ? "Pedindo…" : "Montar o site de novo com as mudanças"}
          </Button>
        </section>
      )}

      {site.status === "needs_attention" && !locked && (
        <Button asChild size="lg" className="justify-self-start">
          <Link href={`/criar/${site.id}/direcao`}>Revisar as respostas e tentar de novo</Link>
        </Button>
      )}

      {events.length > 0 && (
        <section aria-labelledby="historico" className="grid gap-4">
          <h2 id="historico" className="font-display text-[1.375rem] leading-tight">
            O que aconteceu
          </h2>
          <ol className="grid gap-3 border-l border-line-strong pl-5">
            {events.map((event) => (
              <li key={event.id} className="grid gap-0.5">
                <span className="text-[0.9375rem]">{event.message}</span>
                <time dateTime={event.created_at} className="text-[0.8125rem] text-ink-soft">
                  {new Date(event.created_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </time>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function DirectionCard({
  direction,
  renders,
  busy,
  choosing,
  onChoose,
}: {
  direction: DirectionRow;
  renders: Record<string, string>;
  busy: boolean;
  choosing: boolean;
  onChoose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const desktop = direction.screenshots.find((path) => path.endsWith("-1280.png"));
  const phone = direction.screenshots.find((path) => path.endsWith("-390.png"));
  const label = directionLabels[direction.direction];
  const colors = Object.values(direction.identity.palette ?? {})
    .filter((value) => /^#[0-9a-f]{6}$/i.test(value))
    .slice(0, 5);

  return (
    <li className="grid content-start gap-4 rounded-xl border border-input bg-card p-4">
      <div className="relative">
        <Shot
          url={desktop && renders[desktop]}
          alt={`Direção ${label}, no computador`}
          className="aspect-[1280/800]"
        />
        {phone && (
          <Shot
            url={renders[phone]}
            alt={`Direção ${label}, no celular`}
            className="absolute right-2 -bottom-3 aspect-[390/844] w-[26%] shadow-lg"
          />
        )}
      </div>
      <div className="grid gap-1 pt-2">
        <h3 className="text-[1.125rem] font-semibold">{label}</h3>
        <p className="text-sm text-ink-soft">{directionNotes[direction.direction]}</p>
      </div>
      {colors.length > 0 && (
        <div className="flex gap-1.5" aria-hidden="true">
          {colors.map((color) => (
            <span
              key={color}
              className="size-5 rounded-full border border-border"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}
      {confirming ? (
        <div className="grid gap-2">
          <p className="text-sm">Escolher “{label}”? A identidade fica fixa depois disso.</p>
          <div className="flex gap-2">
            <Button size="lg" disabled={busy} onClick={onChoose}>
              {choosing ? "Escolhendo…" : "Sim, escolher"}
            </Button>
            <Button size="lg" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
              Voltar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="lg" disabled={busy} onClick={() => setConfirming(true)}>
          Escolher esta
        </Button>
      )}
    </li>
  );
}

function Shot({ url, alt, className }: { url?: string | false; alt: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-table", className)}>
      {url ? (
        // biome-ignore lint/performance/noImgElement: a short-lived signed address of a private file
        <img src={url} alt={alt} className="size-full object-cover object-top" />
      ) : (
        <span className="sr-only">{alt}</span>
      )}
    </div>
  );
}
