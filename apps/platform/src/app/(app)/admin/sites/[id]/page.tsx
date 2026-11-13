"use client";

import { categoryInfo, type FormDraft } from "@brotasites/schema/v1.2";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { JobFailures } from "@/components/admin/job-failures";
import { TeamAction } from "@/components/admin/team-action";
import { Loading, Notice } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/config/pricing";
import { adminGet, adminPost } from "@/lib/admin/client";
import { type AdminJob, failureNoteFor } from "@/lib/job-failures";
import { type RetryPlan, retryRefusals } from "@/lib/retry-job";
import { infoFor } from "@/lib/site-status";
import { previewUrl } from "@/lib/sites";

// One site in the review: what the client sent, the finished site, the reviewer's report and the
// history, then the decision. Every decision needs the site in the right status and is logged.

interface Finding {
  check: string;
  severity: "low" | "medium" | "high";
  security?: boolean;
  where: string;
  width?: number;
  message: string;
}

interface Detail {
  site: {
    id: string;
    status: string;
    status_message: string | null;
    subdomain: string | null;
    preview_token: string | null;
    approved_direction: string | null;
    created_at: string;
  };
  draft: FormDraft;
  ownerEmail: string | null;
  direction: { direction: string; composition_key: string | null; source: string } | null;
  screenshots: string[];
  reports: {
    status: string;
    created_at: string;
    report: { findings?: Finding[]; reason?: string; rounds?: unknown[] };
  }[];
  events: { kind: string; message: string; created_at: string }[];
  decisions: {
    action: string;
    note: string | null;
    from_status: string;
    to_status: string;
    created_at: string;
  }[];
  payments: { purpose: string; status: string; amount_cents: number }[];
  /** E39: the recent jobs, newest first, errors masked. */
  jobs?: AdminJob[];
  /** E39: "Tentar de novo" for a site in needs_attention. */
  retry?:
    | { available: true; step: string; used: number; limit: number }
    | {
        available: false;
        reason: Exclude<RetryPlan, { ok: true }>["reason"];
        used: number;
        limit: number;
      };
}

const actionLabels: Record<string, string> = {
  approve: "Aprovou",
  request_changes: "Pediu ajustes",
  suspend: "Suspendeu",
  unsuspend: "Retirou a suspensão",
};
const severityLabels = { high: "Alta", medium: "Média", low: "Baixa" } as const;
const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function AdminSitePage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // E39: the answer to "Tentar de novo" outlives its section (the site leaves needs_attention).
  const [retried, setRetried] = useState<string | null>(null);
  const load = useCallback(
    () =>
      adminGet<Detail>(`/api/admin/sites/${id}`).then(setDetail, (caught: Error) =>
        setError(caught.message),
      ),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (error)
    return (
      <Notice
        title="Não foi possível abrir o site"
        text={error}
        action={{ href: "/admin", label: "Voltar para a fila" }}
      />
    );
  if (!detail) return <Loading />;
  const { site, draft } = detail;
  const business = draft.business ?? {};
  const contact = draft.contact ?? {};
  const content = draft.content ?? {};
  const preview = previewUrl({ id: site.id, preview_token: site.preview_token });
  const report = detail.reports[0];
  const findings = [...(report?.report.findings ?? [])].sort(
    (a, b) =>
      ["high", "medium", "low"].indexOf(a.severity) - ["high", "medium", "low"].indexOf(b.severity),
  );

  return (
    <div className="grid gap-10">
      <header className="grid gap-2">
        <Link
          href="/admin"
          className="touch-target justify-self-start text-sm font-semibold text-leaf-deep underline-offset-4 hover:underline"
        >
          ← Fila de revisão
        </Link>
        <h1 className="font-display text-[2.5rem] leading-[1.05]">
          {business.name ?? "Site sem nome"}
        </h1>
        <p className="text-ink-soft">
          {[
            business.category && (categoryInfo(business.category)?.label ?? business.category),
            [business.city, business.state].filter(Boolean).join(" - "),
            infoFor(site.status).label,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {site.status_message && <p className="text-[0.9375rem]">{site.status_message}</p>}
      </header>

      {/* E39: first thing on the page when a step failed, before the reviewer's report. */}
      <JobFailures jobs={detail.jobs ?? []} />

      {site.status === "needs_attention" && detail.retry ? (
        <RetryStep
          siteId={site.id}
          retry={detail.retry}
          onDone={async (text) => {
            setRetried(text);
            await load();
          }}
        />
      ) : (
        retried && (
          <p role="status" className="text-[0.9375rem] font-semibold">
            {retried}
          </p>
        )
      )}

      {/* Team exceptions for this site (E24), each logged with the reason. */}
      <section
        aria-labelledby="excecoes"
        className="grid gap-4 rounded-xl border border-input bg-card p-5"
      >
        <h2 id="excecoes" className="font-display text-[1.5rem]">
          Exceções
        </h2>
        <div className="flex flex-wrap gap-6">
          <TeamAction
            action="grant_round"
            target={{ siteId: site.id }}
            label="Liberar 1 rodada extra de direções"
            confirmLabel="Confirmar a rodada extra"
          />
          <TeamAction
            action="extend_cleanup"
            target={{ siteId: site.id }}
            days={14}
            label="Adiar a limpeza em 14 dias"
            confirmLabel="Confirmar o adiamento"
          />
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-10">
          <section aria-labelledby="site-pronto" className="grid gap-4">
            <h2 id="site-pronto" className="font-display text-[1.5rem]">
              Site montado
            </h2>
            {detail.screenshots.length > 0 && (
              <div className="grid grid-cols-[3fr_1fr] items-start gap-3">
                {detail.screenshots
                  .slice()
                  .reverse()
                  .map((url, index) => (
                    // biome-ignore lint/performance/noImgElement: a short-lived signed address of a private file
                    <img
                      key={url}
                      src={url}
                      alt={
                        index === 0
                          ? "Direção aprovada, no computador"
                          : "Direção aprovada, no celular"
                      }
                      className="w-full rounded-lg border border-border"
                    />
                  ))}
              </div>
            )}
            {preview ? (
              <a
                href={preview}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 justify-self-start font-semibold text-leaf-deep underline underline-offset-4"
              >
                Abrir o site montado
                <ExternalLink aria-hidden="true" className="size-4" />
                <span className="sr-only">(abre em outra aba)</span>
              </a>
            ) : (
              <p className="text-sm text-ink-soft">Ainda não há site montado.</p>
            )}
            {detail.direction && (
              <p className="text-sm text-ink-soft">
                Direção {detail.direction.direction} (
                {detail.direction.source === "ai" ? "IA" : "motor"}), composição{" "}
                <code>{detail.direction.composition_key ?? "?"}</code>
              </p>
            )}
          </section>

          <section aria-labelledby="revisor" className="grid gap-3">
            <h2 id="revisor" className="font-display text-[1.5rem]">
              Relatório do revisor
            </h2>
            {!report ? (
              <p className="text-sm text-ink-soft">Sem relatório.</p>
            ) : (
              <>
                <p className="text-sm text-ink-soft">
                  {report.status} · {when(report.created_at)}
                  {report.report.reason ? ` · ${report.report.reason}` : ""}
                </p>
                {findings.length === 0 ? (
                  <p className="text-sm">Nenhum problema encontrado.</p>
                ) : (
                  <ul className="grid gap-2">
                    {findings.map((finding) => (
                      <li
                        key={`${finding.check}-${finding.where}-${finding.width ?? ""}-${finding.message}`}
                        className="rounded-lg border border-border bg-card p-3 text-[0.9375rem]"
                      >
                        <span className="tag mr-2 text-stem">
                          {severityLabels[finding.severity]}
                          {finding.security ? " · segurança" : ""}
                        </span>
                        {finding.message}
                        <span className="block text-[0.8125rem] text-ink-soft">
                          {finding.check} · {finding.where}
                          {finding.width ? ` · ${finding.width}px` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          <section aria-labelledby="respostas" className="grid gap-3">
            <h2 id="respostas" className="font-display text-[1.5rem]">
              O que o cliente enviou
            </h2>
            <dl className="grid gap-2 text-[0.9375rem]">
              <Row label="Conta">{detail.ownerEmail ?? "?"}</Row>
              <Row label="Endereço">{site.subdomain ?? "ainda não escolhido"}</Row>
              <Row label="Descrição">{business.description}</Row>
              <Row label="Ano">{business.foundedYear}</Row>
              <Row label="História">
                {Object.values(business.story ?? {})
                  .filter(Boolean)
                  .join(" / ")}
              </Row>
              <Row label="Contato">
                {[
                  contact.whatsapp && `WhatsApp ${contact.whatsapp}`,
                  contact.phone && `Tel. ${contact.phone}`,
                  contact.email,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Row>
              <Row label="Lugar">
                {contact.hasFixedAddress === false
                  ? `Atende em ${(contact.serviceArea ?? []).join(", ")}`
                  : [contact.street, contact.number, contact.district].filter(Boolean).join(", ")}
              </Row>
              <Row label="Registro">
                {contact.registration
                  ? `${contact.registration.council} ${contact.registration.number}`
                  : undefined}
              </Row>
              <Row label="Serviços">
                {(content.services ?? [])
                  .map((s) => (s.price ? `${s.name} (${s.price})` : s.name))
                  .join(" · ")}
              </Row>
              <Row label="Depoimentos">
                {(content.testimonials ?? [])
                  .map((t) => `${t.name}${t.authorized ? "" : " (sem autorização)"}`)
                  .join(" · ")}
              </Row>
              <Row label="Fotos">
                {`${(content.photos ?? []).length} (${(content.photos ?? []).filter((p) => p.showsPeople).length} com pessoas, ${(content.photos ?? []).filter((p) => p.showsMinor).length} com menores)`}
              </Row>
              <Row label="Pagamentos">
                {detail.payments
                  .map((p) => `${p.purpose} ${formatBRL(p.amount_cents / 100)} ${p.status}`)
                  .join(" · ") || "nenhum"}
              </Row>
            </dl>
          </section>
        </div>

        <div className="grid content-start gap-10">
          <Decision
            status={site.status}
            siteId={site.id}
            hasPreview={Boolean(preview)}
            onDone={load}
          />
          <section aria-labelledby="historico" className="grid gap-3">
            <h2 id="historico" className="font-display text-[1.5rem]">
              Histórico
            </h2>
            <ol className="grid gap-3 border-l border-line-strong pl-5 text-[0.9375rem]">
              {[
                ...detail.decisions.map((d) => ({
                  at: d.created_at,
                  text: `Equipe: ${actionLabels[d.action] ?? d.action} (${d.from_status} → ${d.to_status})${d.note ? `: ${d.note}` : ""}`,
                })),
                ...detail.events.map((e) => {
                  // E39: the team sees which step failed and why; the client's text stays generic.
                  const note =
                    e.kind === "job_failed"
                      ? failureNoteFor(e.created_at, detail.jobs ?? [])
                      : null;
                  return {
                    at: e.created_at,
                    text: note ? `${e.message} (Equipe: ${note})` : e.message,
                  };
                }),
              ]
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((item) => (
                  <li key={`${item.at}-${item.text}`} className="grid gap-0.5">
                    <span>{item.text}</span>
                    <time dateTime={item.at} className="text-[0.8125rem] text-ink-soft">
                      {when(item.at)}
                    </time>
                  </li>
                ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === undefined || children === null || children === "") return null;
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
      <dt className="font-semibold">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

/**
 * E39: runs the failed step again, as a new job with the same answers; no new site. Two clicks
 * (Murphy): each run can call the AI again, and the count per day is limited.
 */
function RetryStep({
  siteId,
  retry,
  onDone,
}: {
  siteId: string;
  retry: NonNullable<Detail["retry"]>;
  /** Called with the answer once the new attempt is queued. */
  onDone: (message: string) => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await adminPost<{ started: boolean }>(`/api/admin/sites/${siteId}/retry`, {
        confirm: true,
      });
      setConfirming(false);
      await onDone(
        result.started
          ? "Nova tentativa iniciada. O site sai desta lista e volta se falhar de novo."
          : "Nova tentativa na fila, mas a fila de tarefas não respondeu. Confira o Trigger.dev.",
      );
    } catch (caught) {
      setMessage((caught as Error).message);
    }
    setBusy(false);
  }

  return (
    <section
      aria-labelledby="tentar-de-novo"
      className="grid gap-3 rounded-xl border border-pollen/60 bg-pollen/10 p-5"
    >
      <h2 id="tentar-de-novo" className="font-display text-[1.5rem]">
        Tentar de novo
      </h2>
      {retry.available ? (
        <>
          <p className="text-[0.9375rem]">
            Etapa que falhou: <strong>{retry.step}</strong>. Roda de novo com as mesmas respostas,
            sem criar outro site. Use depois de corrigir a causa (por exemplo, depois do “Deploy
            jobs”).
          </p>
          <p className="text-sm text-ink-soft">
            {retry.used} de {retry.limit} tentativas usadas nas últimas 24 horas.
          </p>
          {confirming ? (
            <span className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={() => void run()}
              >
                {busy ? "Pedindo…" : `Confirmar: ${retry.step.toLowerCase()} de novo`}
              </Button>
              <Button
                size="lg"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                Cancelar
              </Button>
            </span>
          ) : (
            <Button
              size="lg"
              variant="outline"
              className="justify-self-start"
              onClick={() => setConfirming(true)}
            >
              Tentar de novo
            </Button>
          )}
        </>
      ) : (
        <p className="text-[0.9375rem]">{retryRefusals[retry.reason][1]}</p>
      )}
      <p role="status" className="text-[0.9375rem] font-semibold empty:hidden">
        {message}
      </p>
    </section>
  );
}

function Decision({
  status,
  siteId,
  hasPreview,
  onDone,
}: {
  status: string;
  siteId: string;
  hasPreview: boolean;
  onDone: () => Promise<unknown>;
}) {
  const noteId = useId();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Suspending takes a site off the air: a second, deliberate click (Murphy).
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const reviewable = status === "in_review" || status === "needs_attention";

  async function decide(action: string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await adminPost<{ hosting?: string }>(`/api/admin/sites/${siteId}/decide`, {
        action,
        note,
      });
      setNote("");
      await onDone();
      setMessage(
        result.hosting === "off" || result.hosting === "failed"
          ? "Decisão registrada, mas o site publicado ainda não mudou: a hospedagem não respondeu. Tente de novo ou mude o estado no Cloudflare."
          : "Decisão registrada.",
      );
    } catch (caught) {
      setMessage((caught as Error).message);
    }
    setBusy(false);
  }

  return (
    <section
      aria-labelledby="decisao"
      className="grid gap-4 rounded-xl border border-input bg-card p-5"
    >
      <h2 id="decisao" className="font-display text-[1.5rem]">
        Decisão
      </h2>
      <div className="grid gap-2">
        <label htmlFor={noteId} className="text-[0.9375rem] font-semibold">
          Nota
        </label>
        <textarea
          id={noteId}
          value={note}
          maxLength={1000}
          rows={4}
          onChange={(event) => setNote(event.target.value)}
          className="rounded-lg border border-input bg-card p-3 text-base outline-none focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/15"
        />
        <p className="text-sm text-ink-soft">
          Obrigatória para pedir ajustes (vai para o passo de conteúdo) e para suspender (o cliente
          vê o motivo).
        </p>
      </div>
      {reviewable && !hasPreview && (
        <p id="sem-previa" className="text-sm text-ink-soft">
          Aprovar fica disponível quando o site pronto tiver uma prévia para conferir.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {reviewable && (
          <>
            <Button
              size="lg"
              disabled={busy || !hasPreview}
              aria-describedby={hasPreview ? undefined : "sem-previa"}
              onClick={() => void decide("approve")}
            >
              Aprovar para o cliente
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={busy}
              onClick={() => void decide("request_changes")}
            >
              Pedir ajustes
            </Button>
          </>
        )}
        {status === "suspended" ? (
          <Button
            size="lg"
            variant="outline"
            disabled={busy}
            onClick={() => void decide("unsuspend")}
          >
            Retirar a suspensão
          </Button>
        ) : confirmSuspend ? (
          // Far from the approve button (Fitts): on its own at the end of the row.
          <span className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <Button
              size="lg"
              variant="destructive"
              disabled={busy}
              onClick={() => void decide("suspend")}
            >
              Confirmar suspensão
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setConfirmSuspend(false)}>
              Cancelar
            </Button>
          </span>
        ) : (
          <Button
            size="lg"
            variant="outline"
            disabled={busy}
            onClick={() => setConfirmSuspend(true)}
            className="text-destructive sm:ml-auto"
          >
            Suspender
          </Button>
        )}
      </div>
      <p role="status" className="text-[0.9375rem] font-semibold empty:hidden">
        {message}
      </p>
    </section>
  );
}
