"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { Loading, Notice } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminGet } from "@/lib/admin/client";
import { dateTime, formatCount, formatUsd } from "@/lib/admin/format";

// Team panel, accounts (E24): search by e-mail or name, filters and order, a page at a time. The
// search is sent with fetch, so no e-mail ends up in the page's address.

interface Row {
  userId: string;
  email: string;
  name: string | null;
  createdAt: string;
  confirmed: boolean;
  openSites: number;
  paidSites: number;
  atLimit: boolean;
  costUsd: number;
}
interface Result {
  total: number;
  rows: Row[];
  page: number;
  pageSize: number;
}

const filters = [
  ["", "Todas"],
  ["confirmed", "E-mail confirmado"],
  ["open", "Com site em andamento"],
  ["paid", "Com site pago"],
  ["limit", "Estourou o limite de rodadas"],
] as const;
const sorts = [
  ["recent", "Mais novas"],
  ["oldest", "Mais antigas"],
  ["cost", "Maior custo"],
  ["email", "E-mail"],
] as const;

export default function AccountsPage() {
  const searchId = useId();
  const filterId = useId();
  const sortId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((q: string, f: string, s: string, p: number) => {
    const params = new URLSearchParams({ q, filter: f, sort: s, page: String(p) });
    setResult(null);
    adminGet<Result>(`/api/admin/accounts?${params}`).then(setResult, (caught: Error) =>
      setError(caught.message),
    );
  }, []);

  useEffect(() => {
    document.title = "Contas · BrotaSites";
    load("", "", "recent", 0);
  }, [load]);

  if (error) return <Notice title="Não foi possível abrir as contas" text={error} />;
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="grid gap-8">
      <h1 className="font-display text-[2.5rem] leading-[1.05]">Contas</h1>
      <form
        aria-label="Buscar contas"
        className="grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(0);
          load(query, filter, sort, 0);
        }}
      >
        <div className="grid gap-2">
          <label htmlFor={searchId} className="text-[0.9375rem] font-semibold">
            Buscar por e-mail ou nome
          </label>
          <Input
            id={searchId}
            type="search"
            value={query}
            maxLength={120}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor={filterId} className="text-[0.9375rem] font-semibold">
            Filtro
          </label>
          <select
            id={filterId}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-[3.25rem] rounded-xl border border-input bg-card px-3"
          >
            {filters.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <label htmlFor={sortId} className="text-[0.9375rem] font-semibold">
            Ordem
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-[3.25rem] rounded-xl border border-input bg-card px-3"
          >
            {sorts.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="lg">
          Buscar
        </Button>
      </form>

      {!result ? (
        <Loading />
      ) : result.rows.length === 0 ? (
        <p className="text-ink-soft">Nenhuma conta encontrada.</p>
      ) : (
        <>
          <p role="status" className="text-[0.9375rem] text-ink-soft">
            {formatCount(result.total)} {result.total === 1 ? "conta" : "contas"}
          </p>
          <ul className="grid gap-3">
            {result.rows.map((row) => (
              <li key={row.userId}>
                <Link
                  href={`/admin/contas/${row.userId}`}
                  className="grid gap-1 rounded-xl border border-input bg-card p-4 transition-colors hover:border-leaf"
                >
                  <span className="font-semibold break-all">{row.email}</span>
                  <span className="text-sm text-ink-soft">
                    {[
                      row.name,
                      row.confirmed ? "e-mail confirmado" : "e-mail não confirmado",
                      `${row.openSites} em andamento`,
                      `${row.paidSites} pagos`,
                      row.atLimit && "estourou o limite de rodadas",
                      `IA ${formatUsd(row.costUsd)}`,
                      `desde ${dateTime(row.createdAt)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
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
                onClick={() => {
                  setPage(page - 1);
                  load(query, filter, sort, page - 1);
                }}
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
                onClick={() => {
                  setPage(page + 1);
                  load(query, filter, sort, page + 1);
                }}
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
