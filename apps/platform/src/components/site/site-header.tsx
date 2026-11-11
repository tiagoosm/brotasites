"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Brand } from "@/components/brand";
import { Button, buttonVariants } from "@/components/ui/button";
import { CreateSiteButton } from "./create-site-button";
import { LinkPending, useIntentPrefetch } from "./link-pending";
import {
  accountItems,
  currentLink,
  type HeaderSession,
  headerLinks,
  signInLink,
  signUpLink,
  visiblePath,
  visitorButtons,
  withoutCurrent,
} from "./nav";
import { ProfileMenu } from "./profile-menu";
import { SignOutButton } from "./sign-out";

/**
 * The one header of every page (E17): the brand, the same three links (Como funciona, Preço,
 * Ajuda), and the account on the right. Signed out (E30): "Entrar" (quiet) and "Criar conta"
 * (the one highlight), never the page the person is on and none on the password screens; never
 * "Criar meu site" for visitors (E26). Signed in: "Criar meu site" and the profile menu. Who is signed in comes from the server (the
 * public page variant the proxy picked, or the session the signed-in pages read), never from
 * the browser, so nothing flickers. Up to 768px: the brand, the profile button and the menu.
 */
export function SiteHeader({
  session,
  pending = false,
}: {
  session: HeaderSession;
  /** The account side is still being read (E26): the shell shows, the right side waits. */
  pending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = visiblePath(usePathname());
  const current = currentLink(pathname);
  const visitor = visitorButtons(pathname);

  // Navigating closes the phone menu.
  useEffect(() => {
    if (pathname) setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 sm:px-8 md:gap-5 lg:gap-6">
        <Brand />
        <nav
          aria-label="Principal"
          className="mx-auto hidden items-center gap-4 text-[0.875rem] md:flex lg:gap-7 lg:text-[0.9375rem]"
        >
          {headerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={current === link.href ? "page" : undefined}
              className="touch-target text-ink-soft transition-colors duration-150 hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink"
            >
              {link.label}
              <LinkPending />
            </Link>
          ))}
        </nav>
        {/* A fixed width from 768px, signed in, out or still reading: the middle links never
            move (E26). Wide enough for "Entrar" and "Criar conta" side by side (E30). */}
        <div className="ml-auto flex items-center justify-end gap-2.5 md:ml-0 md:w-56 lg:w-64 lg:gap-3">
          {pending && (
            <span
              aria-hidden="true"
              className="skeleton-block hidden h-11 w-full rounded-full md:block"
            />
          )}
          {!pending && !session.signedIn && visitor.signIn && <SignInLink />}
          {!pending && !session.signedIn && visitor.signUp && (
            <CreateSiteButton
              href={signUpLink.href}
              size="nav"
              arrow={false}
              className="hidden whitespace-nowrap md:inline-flex"
            >
              {signUpLink.label}
            </CreateSiteButton>
          )}
          {!pending && session.signedIn && <ProfileMenu session={session} />}
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
      </div>
      {open && <PhoneMenu session={session} pathname={pathname} onClose={() => setOpen(false)} />}
    </header>
  );
}

/**
 * Full-screen sheet for phones. Focus moves in and stays inside while it is open, the rest of
 * the page is inert and does not scroll, and Escape or any link closes it and brings focus
 * back to the button. The items come in one after the other (".phone-menu" in globals.css).
 */
function PhoneMenu({
  session,
  pathname,
  onClose,
}: {
  session: HeaderSession;
  pathname: string;
  onClose: () => void;
}) {
  // The middle links (never the page the person is on), then, signed in, the account's items:
  // the same on every page, the current one marked (E32; no "Criar meu site", creating starts
  // from Meus sites). Signed out, the bottom holds "Criar conta" and "Entrar" (E30), each only
  // away from its own screen and neither on the password screens.
  const middle = withoutCurrent(headerLinks, pathname);
  const account = session.signedIn ? [...accountItems(session.known ? session.team : false)] : [];
  const links = [...middle, ...account];
  const visitor = visitorButtons(pathname);
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
          <Fragment key={link.href}>
            {index === middle.length && (
              <p
                className="phone-menu-item tag mt-8 mb-1 text-stem"
                style={{ "--item": index } as React.CSSProperties}
              >
                {session.signedIn ? "Sua conta" : "Conta"}
              </p>
            )}
            <Link
              href={link.href}
              // The form and account pages carry the account code; load it only when opened.
              prefetch={link.account ? false : undefined}
              aria-current={link.href === pathname ? "page" : undefined}
              onClick={onClose}
              style={{ "--item": index } as React.CSSProperties}
              className="phone-menu-item group flex min-h-14 items-center justify-between border-b border-line py-3 font-display text-[1.75rem] leading-tight text-ink transition-colors duration-150 active:text-leaf-deep aria-[current=page]:text-leaf-deep"
            >
              {link.label}
              <ArrowRight
                aria-hidden="true"
                className="size-5 text-leaf opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
              <LinkPending dot={false} />
            </Link>
          </Fragment>
        ))}
      </nav>
      {session.signedIn && (
        <SignOutButton
          className="phone-menu-item min-h-14 shrink-0 justify-self-start border-b border-line py-3 text-left font-display text-[1.75rem] text-ink"
          style={{ "--item": links.length } as React.CSSProperties}
        />
      )}
      {!session.signedIn && (visitor.signIn || visitor.signUp) && (
        <div
          className="phone-menu-item mt-auto grid shrink-0 gap-3 pt-8"
          style={{ "--item": links.length + 1 } as React.CSSProperties}
        >
          {/* E30: the highlight on top, the quiet one under it, both full width. */}
          {visitor.signUp && (
            <CreateSiteButton href={signUpLink.href} arrow={false} onClick={onClose}>
              {signUpLink.label}
            </CreateSiteButton>
          )}
          {visitor.signIn && (
            <Link
              href={signInLink.href}
              prefetch={false}
              onClick={onClose}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {signInLink.label}
              <LinkPending dot={false} />
            </Link>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

/**
 * "Entrar" (E30): a quiet pill, ink on paper with a soft wash on hover, the same height, radius,
 * focus ring and press as "Criar conta" beside it; only the colour differs. Not prefetched from
 * the public pages, but warmed up by intent.
 */
function SignInLink() {
  const intent = useIntentPrefetch(signInLink.href);
  return (
    <Link
      href={signInLink.href}
      prefetch={false}
      {...intent}
      className="relative hidden h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap text-ink transition-[transform,background-color] duration-150 ease-out outline-none hover:bg-leaf-wash focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] md:inline-flex lg:text-[0.9375rem]"
    >
      {signInLink.label}
      <LinkPending />
    </Link>
  );
}
