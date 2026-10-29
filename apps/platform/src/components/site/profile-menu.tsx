"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { accountItems, type HeaderSession } from "./nav";

// The profile button and its menu (E17): the person's initials (or a person icon), and a menu
// with who is signed in, Painel, Criar site, Perfil e segurança, Área da equipe (team only) and
// Sair. Menu-button pattern of the ARIA practices: Enter, Space or arrows open it on the first
// (or last) item, arrows move, Home/End jump, Escape closes back on the button, Tab and a click
// outside close it.
//
// On internal pages the server already read the name, email and team; on the prerendered public
// pages it only knows the person is signed in, so the menu asks the server (/api/account/me) the
// first time it opens. Showing "Área da equipe" grants nothing: /admin checks on the server.

interface Who {
  name: string;
  email: string;
  team: boolean;
}

type Signed = Extract<HeaderSession, { signedIn: true }>;

export function ProfileMenu({ session }: { session: Signed }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState<Who | null>(
    session.known ? { name: session.name, email: session.email, team: session.team } : null,
  );
  const button = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const labelId = useId();

  const items = () => [
    ...(popup.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
  ];
  const focusItem = (index: number) => {
    const list = items();
    if (list.length === 0) return;
    list[(index + list.length) % list.length]?.focus();
  };

  const close = useCallback((focusButton: boolean) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  }, []);

  // What the prerendered pages could not know: asked once, when the menu first opens.
  useEffect(() => {
    if (!open || who) return;
    let cancelled = false;
    fetch("/api/account/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Who | null) => {
        if (!cancelled && data) setWho({ name: data.name, email: data.email, team: data.team });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, who]);

  // A click outside closes it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popup.current?.contains(target) && !button.current?.contains(target)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, close]);

  function openAt(index: number) {
    setOpen(true);
    // The items exist once the popup is shown (next frame).
    requestAnimationFrame(() => focusItem(index));
  }

  function onButtonKey(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openAt(0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAt(-1);
    }
  }

  function onMenuKey(event: React.KeyboardEvent) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusItem(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusItem(0);
        break;
      case "End":
        event.preventDefault();
        focusItem(-1);
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
    }
  }

  const initials = initialsOf(who?.name);
  const links = accountItems(who?.team ?? false);

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={who?.name ? `Menu da conta de ${who.name}` : "Menu da conta"}
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={onButtonKey}
        className="grid size-11 place-items-center rounded-full border border-leaf/40 bg-leaf/10 text-[0.9375rem] font-semibold text-leaf-deep transition-colors duration-150 hover:bg-leaf/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-deep"
      >
        {initials ? (
          <span aria-hidden="true">{initials}</span>
        ) : (
          <User aria-hidden="true" className="size-5" />
        )}
      </button>
      <div
        ref={popup}
        id={menuId}
        hidden={!open}
        className="profile-menu absolute right-0 z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-line bg-card p-2 text-[0.9375rem] shadow-lg"
      >
        <div id={labelId} className="grid gap-0.5 border-b border-line px-3 pt-2 pb-3">
          <span className="truncate font-semibold">{who?.name || "Sua conta"}</span>
          {who?.email && (
            <span className="truncate text-[0.8125rem] text-ink-soft">{who.email}</span>
          )}
        </div>
        <div role="menu" aria-labelledby={labelId} onKeyDown={onMenuKey} className="grid pt-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              tabIndex={-1}
              prefetch={false}
              onClick={() => close(false)}
              className={itemClass}
            >
              {link.label}
            </Link>
          ))}
          <form action="/auth/sair" method="post" className="contents">
            <input type="hidden" name="voltar" value="/" />
            <button
              type="submit"
              role="menuitem"
              tabIndex={-1}
              className={cn(itemClass, "text-left")}
            >
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const itemClass =
  "flex min-h-11 w-full items-center rounded-lg px-3 font-medium text-ink outline-none hover:bg-leaf/10 focus-visible:bg-leaf/10 focus-visible:outline-2 focus-visible:outline-leaf-deep";
