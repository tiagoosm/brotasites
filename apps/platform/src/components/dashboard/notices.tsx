"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { postJson } from "@/components/account/api";
import { cn } from "@/lib/utils";

// The dashboard's notices (E16): a bell with the unread count; opening it shows the latest and
// marks them as read. Sentences and links are made on the server (lib/dashboard.ts).

export interface NoticeView {
  id: string;
  text: string;
  href: string;
  date: string;
  unread: boolean;
}

export function NoticesBell({ notices, unread }: { notices: NoticeView[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notices);
  const [count, setCount] = useState(unread);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(notices);
    setCount(unread);
  }, [notices, unread]);

  // Escape or a click outside closes it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  async function mark(body: { ids: string[] } | { all: true }) {
    const result = await postJson<{ marked?: number }>("/api/notifications/read", body);
    if (!result.ok) return;
    const ids = "ids" in body ? new Set(body.ids) : null;
    setItems((list) =>
      list.map((item) => (!ids || ids.has(item.id) ? { ...item, unread: false } : item)),
    );
    setCount((value) => (ids ? Math.max(0, value - ids.size) : 0));
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const ids = items.filter((item) => item.unread).map((item) => item.id);
      if (ids.length > 0) void mark({ ids });
    }
  }

  const label = count > 0 ? `Avisos, ${count} não ${count === 1 ? "lido" : "lidos"}` : "Avisos";

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="touch-target relative inline-flex size-11 items-center justify-center rounded-full text-leaf-deep hover:bg-leaf/10"
      >
        <Bell aria-hidden="true" className="size-5" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 grid min-w-5 place-items-center rounded-full bg-stem px-1 text-[0.6875rem] font-semibold leading-5 text-white"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      <div
        ref={panel}
        id={panelId}
        hidden={!open}
        className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2.5rem))] rounded-xl border border-input bg-card p-2 text-[0.9375rem] shadow-lg"
      >
        <div className="flex items-center justify-between gap-3 px-2 py-1">
          <h2 className="font-semibold">Avisos</h2>
          {items.some((item) => item.unread) && (
            <button
              type="button"
              onClick={() => void mark({ all: true })}
              className="touch-target text-[0.8125rem] font-semibold text-leaf-deep underline-offset-4 hover:underline"
            >
              Marcar todos como lidos
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-2 py-3 text-ink-soft">Nenhum aviso por enquanto.</p>
        ) : (
          <ul className="grid">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "grid min-h-11 gap-0.5 rounded-lg px-2 py-2 hover:bg-leaf/5",
                    item.unread && "font-semibold",
                  )}
                >
                  <span>{item.text}</span>
                  <span className="text-[0.8125rem] font-normal text-ink-soft">
                    {item.date}
                    {item.unread && <span className="sr-only"> (novo)</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
