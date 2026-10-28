"use client";

import { categoryInfo, type FormDraft } from "@brotasites/schema/v1.2";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { Loading, Notice } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/config/pricing";
import { adminGet, adminPost } from "@/lib/admin/client";
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
                ...detail.events.map((e) => ({ at: e.created_at, text: e.message })),
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
  const [message, setMessage] = useState<string | null>(null);
  const reviewable = status === "in_review" || status === "needs_attention";

  async function decide(action: string) {
    setBusy(true);
    setMessage(null);
    try {
      await adminPost(`/api/admin/sites/${siteId}/decide`, { action, note });
      setNote("");
      await onDone();
      setMessage("Decisão registrada.");
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
          Obrigatória para pedir ajustes (vai para a etapa de textos) e para suspender (o cliente vê
          o motivo).
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {reviewable && (
          <>
            <Button size="lg" disabled={busy || !hasPreview} onClick={() => void decide("approve")}>
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
        ) : (
          <Button
            size="lg"
            variant="destructive"
            disabled={busy}
            onClick={() => void decide("suspend")}
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
