"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CREATE_HREF, guestLinks, headerLinks, memberLinks, phoneMenuLinks } from "./nav";
import { SignOutButton } from "./sign-out";

/**
 * Quiet sticky header: brand, two links, sign in and the one primary action. Signed in, the
 * account's menu instead (Painel, Criar site, Perfil e segurança, Sair). `signedIn` comes from
 * the server (the page variant the proxy picked), so the menu never flickers.
 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  // Navigating closes the phone menu.
  useEffect(() => {
    if (pathname) setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 sm:gap-6 sm:px-8">
        <Brand />
        <nav aria-label="Principal" className="ml-auto hidden items-center gap-7 md:flex">
          {(signedIn ? memberLinks : headerLinks).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={link.account ? false : undefined}
              aria-current={pathname === link.href ? "page" : undefined}
              className="touch-target text-[0.9375rem] text-ink-soft transition-colors duration-150 hover:text-ink aria-[current=page]:text-ink"
            >
              {link.label}
            </Link>
          ))}
          {signedIn ? (
            <SignOutButton className="text-[0.9375rem] font-semibold text-leaf-deep underline-offset-4 hover:underline" />
          ) : (
            // "Criar conta" sits next to "Entrar" where no "Criar meu site" button is shown.
            (isHome ? guestLinks : guestLinks.slice(0, 1)).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className="touch-target text-[0.9375rem] font-semibold text-leaf-deep underline-offset-4 hover:underline"
              >
                {link.label}
              </Link>
            ))
          )}
        </nav>
        {/* The home page has its own buttons (at most three); the other pages get one here.
            Signed in, "Criar site" is already in the menu. */}
        {!isHome && !signedIn && (
          <Button
            asChild
            size="lg"
            className="touch-target ml-auto h-9 px-4 text-sm sm:h-10 sm:px-5 sm:text-[0.9375rem] md:ml-0"
          >
            <Link href={CREATE_HREF} prefetch={false}>
              Criar meu site
            </Link>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className={cn("touch-target -mr-2 md:hidden", (isHome || signedIn) && "ml-auto")}
          aria-label="Abrir menu"
          aria-expanded={open}
          aria-controls="menu-celular"
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden="true" className="size-5" />
        </Button>
      </div>
      {open && <PhoneMenu signedIn={signedIn} onClose={() => setOpen(false)} />}
    </header>
  );
}

/**
 * Full-screen sheet for phones. Focus moves in and stays inside while it is open, the rest of
 * the page is inert and does not scroll, and Escape or any link closes it and brings focus
 * back to the button. The items come in one after the other (".phone-menu" in globals.css).
 */
function PhoneMenu({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const links = [...phoneMenuLinks, ...(signedIn ? memberLinks : guestLinks.slice(0, 1))];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    if (!panel) return;
    panel.querySelector<HTMLElement>("a, button")?.focus();

    // Everything around the menu, up to the body, becomes inert while it is open.
    const inert: HTMLElement[] = [];
    for (let node: HTMLElement | null = panel; node && node !== document.body; ) {
      const parent: HTMLElement | null = node.parentElement;
      for (const sibling of parent?.children ?? []) {
        if (sibling !== node && sibling instanceof HTMLElement && !sibling.inert) {
          sibling.inert = true;
          inert.push(sibling);
        }
      }
      node = parent;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
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
    // Both: iOS Safari keeps scrolling the page when only the body is locked.
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      for (const element of inert) element.inert = false;
      opener?.focus();
    };
  }, [onClose]);

  // Rendered in the body: the header's backdrop blur would otherwise become the box of this
  // fixed sheet and squeeze it into the header's 64px.
  return createPortal(
    <div
      id="menu-celular"
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="phone-menu fixed inset-0 z-40 flex flex-col overflow-y-auto bg-paper px-5 pt-3 pb-8 md:hidden"
    >
      <div className="flex h-10 shrink-0 items-center justify-between">
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
        {links.map((link, index) => (
          <Link
            key={link.href}
            href={link.href}
            // The form and account pages carry the account code; load it only when opened.
            prefetch={link.account ? false : undefined}
            onClick={onClose}
            style={{ "--item": index } as React.CSSProperties}
            className="phone-menu-item group flex min-h-14 items-center justify-between border-b border-line py-3 font-display text-[1.75rem] leading-tight text-ink transition-colors duration-150 active:text-leaf-deep"
          >
            {link.label}
            <ArrowRight
              aria-hidden="true"
              className="size-5 text-leaf opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </Link>
        ))}
      </nav>
      {signedIn ? (
        <SignOutButton
          className="phone-menu-item mt-auto min-h-14 shrink-0 justify-self-start font-display text-[1.75rem] text-ink"
          style={{ "--item": links.length } as React.CSSProperties}
        />
      ) : (
        <Button
          asChild
          size="lg"
          className="phone-menu-item mt-auto shrink-0"
          style={{ "--item": links.length } as React.CSSProperties}
        >
          <Link href="/cadastro" prefetch={false} onClick={onClose}>
            Criar conta
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      )}
    </div>,
    document.body,
  );
}
