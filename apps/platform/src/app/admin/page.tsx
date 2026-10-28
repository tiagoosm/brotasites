"use client";

import { categoryInfo } from "@brotasites/schema/v1.2";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loading, Notice } from "@/components/shared/page-state";
import { adminGet } from "@/lib/admin/client";
import { infoFor } from "@/lib/site-status";
import { cn } from "@/lib/utils";

interface QueueItem {
  id: string;
  status: string;
  statusMessage: string | null;
  subdomain: string | null;
  updatedAt: string;
  name: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  review: string | null;
}

const tabs = [
  { status: "in_review", label: "Em revisão" },
  { status: "needs_attention", label: "Precisa de atenção" },
  { status: "suspended", label: "Suspensos" },
] as const;

const reviewLabels: Record<string, string> = {
  passed: "Revisor: sem problemas",
  changesNeeded: "Revisor: ajustes sugeridos",
  needsAttention: "Revisor: precisa de uma pessoa",
};

export default function AdminQueuePage() {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]["status"]>("in_review");
  useEffect(() => {
    document.title = "Fila de revisão · BrotaSites";
    adminGet<QueueItem[]>("/api/admin/queue").then(setItems, (caught: Error) =>
      setError(caught.message),
    );
  }, []);

  if (error) return <Notice title="Não foi possível abrir a fila" text={error} />;
  if (!items) return <Loading />;
  const shown = items.filter((item) => item.status === tab);

  return (
    <div className="grid gap-8">
      <h1 className="font-display text-[2.5rem] leading-[1.05]">Fila de revisão</h1>
      <div role="tablist" aria-label="Situação" className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const count = items.filter((site) => site.status === item.status).length;
          return (
            <button
              key={item.status}
              type="button"
              role="tab"
              aria-selected={tab === item.status}
              onClick={() => setTab(item.status)}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[0.9375rem]",
                tab === item.status
                  ? "border-leaf bg-leaf-wash font-semibold text-leaf-deep"
                  : "border-input bg-card",
              )}
            >
              {item.label} <span className="tag">{count}</span>
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <p className="text-ink-soft">Nada aqui agora.</p>
      ) : (
        <ul className="grid gap-3">
          {shown.map((item) => (
            <li key={item.id}>
              <Link
                href={`/admin/sites/${item.id}`}
                className="grid gap-1 rounded-xl border border-input bg-card p-5 transition-colors hover:border-leaf"
              >
                <span className="text-[1.125rem] font-semibold">
                  {item.name ?? "Site sem nome"}
                </span>
                <span className="text-sm text-ink-soft">
                  {[
                    item.category && (categoryInfo(item.category)?.label ?? item.category),
                    [item.city, item.state].filter(Boolean).join(" - "),
                    infoFor(item.status).label,
                    item.review && reviewLabels[item.review],
                    `desde ${new Date(item.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {item.statusMessage && <span className="text-sm">{item.statusMessage}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
