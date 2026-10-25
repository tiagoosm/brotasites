"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CREATE_HREF, headerLinks } from "./nav";

/** Quiet sticky header: brand, two links, sign in and the one primary action. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating closes the phone menu.
  useEffect(() => {
    if (pathname) setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 sm:gap-6 sm:px-8">
        <Brand />
        <nav aria-label="Principal" className="ml-auto hidden items-center gap-7 md:flex">
          {headerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className="touch-target text-[0.9375rem] text-ink-soft transition-colors duration-150 hover:text-ink aria-[current=page]:text-ink"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/entrar"
            prefetch={false}
            className="touch-target text-[0.9375rem] font-semibold text-leaf-deep underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </nav>
        <Button
          asChild
          size="lg"
          className="touch-target ml-auto h-9 px-4 text-sm sm:h-10 sm:px-5 sm:text-[0.9375rem] md:ml-0"
        >
          <Link href={CREATE_HREF} prefetch={false}>
            Criar meu site
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="touch-target -mr-2 md:hidden"
          aria-label="Abrir menu"
          aria-expanded={open}
          aria-controls="menu-celular"
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden="true" className="size-5" />
        </Button>
      </div>
      {open && <PhoneMenu onClose={() => setOpen(false)} />}
    </header>
  );
}

/** Full-width sheet for phones. Keeps focus inside while open and closes with Escape. */
function PhoneMenu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    panel?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>("a, button")];
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus();
    };
  }, [onClose]);

  return (
    <div
      id="menu-celular"
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-40 flex flex-col bg-paper px-5 pt-3 pb-8 md:hidden"
    >
      <div className="flex h-10 items-center justify-between">
        <span className="tag text-stem">Menu</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="touch-target -mr-2"
          aria-label="Fechar menu"
          onClick={onClose}
        >
          <X aria-hidden="true" className="size-5" />
        </Button>
      </div>
      <nav aria-label="Menu" className="mt-8 grid">
        {[...headerLinks, { href: "/entrar", label: "Entrar" }].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            // The form and sign-in pages carry the account code; load it only when opened.
            prefetch={link.href === "/entrar" ? false : undefined}
            onClick={onClose}
            className={cn(
              "border-b border-line py-4 font-display text-[1.75rem] leading-tight text-ink",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Button asChild size="lg" className="mt-auto">
        <Link href={CREATE_HREF} prefetch={false} onClick={onClose}>
          Criar meu site
        </Link>
      </Button>
    </div>
  );
}
