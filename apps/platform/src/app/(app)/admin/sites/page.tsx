"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useState } from "react";
import { Stat } from "@/components/admin/panel";
import { Loading, Notice } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminGet } from "@/lib/admin/client";
import { dateTime, formatCount } from "@/lib/admin/format";
import type { AdminSiteRow } from "@/lib/admin/sites";
import { infoFor } from "@/lib/site-status";

// Team panel, published sites (E42): search by address and filters "No ar", "Fora do ar" and
// "Exclusão agendada", with how many deletions are scheduled. Each row opens the site's page,
// where "Retirada do ar" acts.

interface Result {
  rows: AdminSiteRow[];
  total: number;
  scheduled: number;
  page: number;
  pageSize: number;
}

const filters = [
  ["", "Todos"],
  ["live", "No ar"],
  ["offline", "Fora do ar"],
  ["scheduled", "Exclusão agendada"],
] as const;

const offlineBy: Record<string, string> = {
  owner: "pelo cliente",
  admin: "pela equipe",
  system: "pela rotina",
};

function rowFacts(row: AdminSiteRow): string {
  return [
    row.status === "offline" && row.offlineBy
      ? `Fora do ar ${offlineBy[row.offlineBy] ?? ""}`.trim()
      : infoFor(row.status).label,
    row.deleteAfter &&
      `exclusão em ${dateTime(row.deleteAfter)} (${row.deletionBy === "owner" ? "cliente" : "equipe"})`,
    row.deletionAttempts > 0 && `${row.deletionAttempts} tentativa(s) falharam`,
    row.publishedAt && `publicado em ${dateTime(row.publishedAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function SitesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SitesList />
    </Suspense>
  );
}

function SitesList() {
  const deleted = useSearchParams().get("excluido") === "1";
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((q: string, f: string, p: number) => {
    const params = new URLSearchParams({ q, filter: f, page: String(p) });
    setResult(null);
    adminGet<Result>(`/api/admin/sites?${params}`).then(setResult, (caught: Error) =>
      setError(caught.message),
    );
  }, []);

  useEffect(() => {
    document.title = "Sites · BrotaSites";
    load("", "", 0);
  }, [load]);

  if (error) return <Notice title="Não foi possível abrir os sites" text={error} />;
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const go = (f: string, p: number) => {
    setFilter(f);
    setPage(p);
    load(query, f, p);
  };

  return (
    <div className="grid gap-8">
      <header className="grid gap-4">
        <h1 className="font-display text-[2.5rem] leading-[1.05]">Sites publicados</h1>
        {deleted && (
          <p role="status" className="text-[0.9375rem] font-semibold">
            Site excluído. O registro ficou no log.
          </p>
        )}
        {result && (
          <dl className="grid max-w-xs">
            <Stat
              label="Exclusões agendadas"
              value={formatCount(result.scheduled)}
              note={result.scheduled ? "A rotina diária exclui quando vence." : undefined}
            />
          </dl>
        )}
      </header>

      <form
        aria-label="Buscar sites"
        className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          go(filter, 0);
        }}
      >
        <div className="grid gap-2">
          <label htmlFor={searchId} className="text-[0.9375rem] font-semibold">
            Buscar pelo endereço
          </label>
          <Input
            id={searchId}
            type="search"
            value={query}
            maxLength={120}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button type="submit" size="lg">
          Buscar
        </Button>
      </form>

      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Filtro</legend>
        {filters.map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="lg"
            variant={filter === value ? "default" : "outline"}
            aria-pressed={filter === value}
            onClick={() => go(value, 0)}
          >
            {label}
            {value === "scheduled" && result ? ` (${formatCount(result.scheduled)})` : ""}
          </Button>
        ))}
      </fieldset>

      {!result ? (
        <Loading />
      ) : result.rows.length === 0 ? (
        <p className="text-ink-soft">Nenhum site encontrado.</p>
      ) : (
        <>
          <p role="status" className="text-[0.9375rem] text-ink-soft">
            {formatCount(result.total)} {result.total === 1 ? "site" : "sites"}
          </p>
          <ul className="grid gap-3">
            {result.rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/sites/${row.id}`}
                  className="grid gap-1 rounded-xl border border-input bg-card p-4 transition-colors hover:border-leaf"
                >
                  <span className="font-semibold break-all">
                    {row.name ?? "Site sem nome"}
                    {row.subdomain && (
                      <span className="font-mono text-[0.875rem] font-normal text-ink-soft">
                        {" "}
                        · {row.subdomain}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-ink-soft">{rowFacts(row)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label="Páginas" className="flex items-center gap-4">
              <Button
                variant="outline"
                size="lg"
                disabled={page === 0}
                onClick={() => go(filter, page - 1)}
              >
                Anterior
              </Button>
              <span className="text-[0.9375rem]">
                Página {page + 1} de {pages}
              </span>
              <Button
                variant="outline"
                size="lg"
                disabled={page + 1 >= pages}
                onClick={() => go(filter, page + 1)}
              >
                Próxima
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
