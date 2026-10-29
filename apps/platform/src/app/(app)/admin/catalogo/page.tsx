"use client";

import { families, familyInfo, sectionIds } from "@brotasites/schema/v1.2";
import { useCallback, useEffect, useId, useState } from "react";
import { Loading, Notice } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { adminGet, adminPost } from "@/lib/admin/client";
import type { CatalogMetrics, Metrics } from "@/lib/admin/metrics";

// The promotion cycle (docs/catalog-promotion.md): what clients choose and approve, per
// composition and per variant. Recommending raises the weight up to a cap; retiring takes it out
// of the draw. The engine keeps exploring (Contraste never uses a recommendation), and weights
// never override contrast, photo requirements or review.

interface Catalog {
  metrics: CatalogMetrics;
  weights: { kind: "composition" | "variant"; ref: string; state: "recommended" | "retired" }[];
  requests: {
    id: number;
    family: string;
    section: string;
    note: string;
    status: string;
    created_at: string;
  }[];
}

const stateLabels = { recommended: "Recomendada", retired: "Aposentada" } as const;

export default function AdminCatalogPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(
    () =>
      adminGet<Catalog>("/api/admin/catalog").then(setCatalog, (caught: Error) =>
        setError(caught.message),
      ),
    [],
  );
  useEffect(() => {
    document.title = "Catálogo · BrotaSites";
    void load();
  }, [load]);

  async function mark(
    kind: "composition" | "variant",
    ref: string,
    state: "recommended" | "retired" | null,
  ) {
    setMessage(null);
    try {
      await adminPost("/api/admin/catalog/weights", { kind, ref, state });
      await load();
      setMessage("Catálogo atualizado. Vale para as próximas direções.");
    } catch (caught) {
      setMessage((caught as Error).message);
    }
  }

  if (error) return <Notice title="Não foi possível abrir o catálogo" text={error} />;
  if (!catalog) return <Loading />;
  const stateOf = (kind: string, ref: string) =>
    catalog.weights.find((weight) => weight.kind === kind && weight.ref === ref)?.state;

  return (
    <div className="grid min-w-0 gap-12">
      <header className="grid gap-3">
        <h1 className="font-display text-[2.5rem] leading-[1.05]">Catálogo</h1>
        <p className="max-w-[60ch] text-ink-soft">
          Recomendar aumenta a chance de uma composição ou variante ser sorteada (até 3 vezes).
          Aposentar tira do sorteio. A direção Contraste sempre explora outras opções, e contraste,
          fotos e revisão continuam valendo.
        </p>
        <p role="status" className="text-[0.9375rem] font-semibold empty:hidden">
          {message}
        </p>
      </header>

      <MetricsTable
        title="Composições"
        rows={catalog.metrics.compositions.map((row) => ({ ...row, ref: row.key }))}
        kind="composition"
        stateOf={stateOf}
        onMark={mark}
      />
      <MetricsTable
        title="Variantes"
        rows={catalog.metrics.variants.map((row) => ({ ...row, ref: row.id }))}
        kind="variant"
        stateOf={stateOf}
        onMark={mark}
      />
      <Requests requests={catalog.requests} onSent={load} />
    </div>
  );
}

function MetricsTable({
  title,
  rows,
  kind,
  stateOf,
  onMark,
}: {
  title: string;
  rows: (Metrics & { ref: string })[];
  kind: "composition" | "variant";
  stateOf: (kind: string, ref: string) => "recommended" | "retired" | undefined;
  onMark: (
    kind: "composition" | "variant",
    ref: string,
    state: "recommended" | "retired" | null,
  ) => void;
}) {
  return (
    <section aria-label={title} className="grid min-w-0 gap-3">
      <h2 className="font-display text-[1.75rem]">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-ink-soft">Ainda não há dados.</p>
      ) : (
        <div className="relative min-w-0 overflow-x-auto rounded-xl border border-input bg-card">
          <table className="w-full min-w-[56rem] text-left text-[0.875rem]">
            <thead className="border-b border-border text-ink-soft">
              <tr>
                {[
                  "",
                  "Sugerida",
                  "Escolhida",
                  "Aprovada",
                  "Ajustes",
                  "Achados (A/M/B)",
                  "Decisões",
                  "Revisão (h)",
                  "Situação",
                ].map((label) => (
                  <th key={label} scope="col" className="px-3 py-2 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const state = stateOf(kind, row.ref);
                return (
                  <tr key={row.ref} className="border-b border-border last:border-0">
                    <th scope="row" className="px-3 py-2 font-mono text-[0.8125rem] font-normal">
                      {row.ref}
                    </th>
                    <td className="px-3 py-2">{row.suggested}</td>
                    <td className="px-3 py-2">{row.chosen}</td>
                    <td className="px-3 py-2">{row.approved}</td>
                    <td className="px-3 py-2">{row.changeRequests}</td>
                    <td className="px-3 py-2">
                      {row.findings.high}/{row.findings.medium}/{row.findings.low}
                    </td>
                    <td className="px-3 py-2">{row.decisions}</td>
                    <td className="px-3 py-2">{row.reviewHours ?? "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {state && <span className="tag text-stem">{stateLabels[state]}</span>}
                        {state !== "recommended" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-11"
                            onClick={() => onMark(kind, row.ref, "recommended")}
                          >
                            Recomendar <span className="sr-only">{row.ref}</span>
                          </Button>
                        )}
                        {state !== "retired" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-11"
                            onClick={() => onMark(kind, row.ref, "retired")}
                          >
                            Aposentar <span className="sr-only">{row.ref}</span>
                          </Button>
                        )}
                        {state && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-11"
                            onClick={() => onMark(kind, row.ref, null)}
                          >
                            Voltar ao normal <span className="sr-only">{row.ref}</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Requests({
  requests,
  onSent,
}: {
  requests: Catalog["requests"];
  onSent: () => Promise<unknown>;
}) {
  const id = useId();
  const [family, setFamily] = useState<string>(families[0]);
  const [section, setSection] = useState<string>("hero");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const select =
    "h-12 rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/15";

  return (
    <section aria-labelledby={`${id}-title`} className="grid gap-4">
      <h2 id={`${id}-title`} className="font-display text-[1.75rem]">
        Pedir uma variante nova
      </h2>
      <p className="max-w-[60ch] text-sm text-ink-soft">
        O pedido vai para a fábrica de variantes: uma pessoa desenha, testa nos 4 estados e aprova
        antes de entrar no catálogo.
      </p>
      <form
        className="grid max-w-[40rem] gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setMessage(null);
          try {
            await adminPost("/api/admin/catalog/requests", { family, section, note });
            setNote("");
            await onSent();
            setMessage("Pedido registrado.");
          } catch (caught) {
            setMessage((caught as Error).message);
          }
        }}
      >
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1 text-sm font-semibold">
            Família
            <select
              value={family}
              onChange={(event) => setFamily(event.target.value)}
              className={select}
            >
              {families.map((item) => (
                <option key={item} value={item}>
                  {familyInfo[item].label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Seção
            <select
              value={section}
              onChange={(event) => setSection(event.target.value)}
              className={select}
            >
              {sectionIds.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          O que falta
          <textarea
            value={note}
            maxLength={1000}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
            className="rounded-lg border border-input bg-card p-3 text-base font-normal outline-none focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/15"
          />
        </label>
        <Button type="submit" size="lg" className="justify-self-start">
          Registrar pedido
        </Button>
        <p role="status" className="text-[0.9375rem] font-semibold empty:hidden">
          {message}
        </p>
      </form>
      {requests.length > 0 && (
        <ul className="grid gap-2 text-[0.9375rem]">
          {requests.map((request) => (
            <li key={request.id} className="rounded-lg border border-border bg-card p-3">
              <span className="tag mr-2 text-stem">
                {request.status === "open" ? "Aberto" : "Feito"} · {request.family} ·{" "}
                {request.section}
              </span>
              {request.note}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
