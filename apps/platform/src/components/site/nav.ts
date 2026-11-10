import { adminUrl } from "@/lib/domains/hosts";

// The one header of every page (E17): the same three links in the middle, and on the right the
// account (sign in, or the profile menu). Shared by the header, the phone menu and the footer.
// E29: nothing leads to the page the person is on, and no link repeats another of the same menu.

// Links to the form, sign-in and account pages use prefetch={false}: those pages carry the
// account and schema code, which the public pages should not download in advance.
export const CREATE_HREF = "/criar";
export const DASHBOARD_HREF = "/meus-sites";
export const ACCOUNT_HREF = "/conta";
/** The team's area: its own host in production (E28), /admin otherwise. */
export const TEAM_HREF = adminUrl("/admin");

export interface NavLink {
  href: string;
  label: string;
  /** An account page: not prefetched from the public pages. */
  account?: boolean;
}

/**
 * The middle of the header, the same signed in or out, on every page. "Dúvidas" left it (E29):
 * Ajuda answers the same questions on a page of its own, and the home page keeps its "Dúvidas"
 * section with "Ver todas as dúvidas".
 */
export const headerLinks: readonly NavLink[] = [
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#preco", label: "Preço" },
  { href: "/ajuda", label: "Ajuda" },
];

/** The sign-in, sign-up and password screens: "Entrar ou cadastre-se" is not offered on them. */
export const ACCOUNT_SCREENS = ["/entrar", "/cadastro", "/esqueci-senha", "/redefinir-senha"];

export function isAccountScreen(pathname: string): boolean {
  return ACCOUNT_SCREENS.some((screen) => pathname === screen || pathname.startsWith(`${screen}/`));
}

/** A menu without the page the person is already on (E29). */
export function withoutCurrent(links: readonly NavLink[], pathname: string): NavLink[] {
  return links.filter((link) => link.href !== pathname);
}

/** Signed out: one way in, to sign in or sign up ("/entrar" links to "/cadastro"). */
export const signInLink: NavLink = {
  href: "/entrar",
  label: "Entrar ou cadastre-se",
  account: true,
};

/** The profile menu ("Sair" is a form, after these). */
export const memberLinks: readonly NavLink[] = [
  { href: DASHBOARD_HREF, label: "Meus sites", account: true },
  { href: CREATE_HREF, label: "Criar meu site", account: true },
  { href: ACCOUNT_HREF, label: "Perfil e segurança", account: true },
];

export const teamLink: NavLink = { href: TEAM_HREF, label: "Área da equipe", account: true };

/**
 * The footer: only what the header does not have (E29). Ajuda and the account live in the
 * header and the profile menu.
 */
export const footerLinks: readonly NavLink[] = [
  { href: "/termos", label: "Termos de uso" },
  { href: "/privacidade", label: "Privacidade" },
];

/**
 * Who the header is for, decided on the server: signed out, or signed in with what the server
 * read (name, email, team). On the prerendered public pages only "signed in" is known; the rest
 * is read when the profile menu opens (`known: false`).
 */
export type HeaderSession =
  | { signedIn: false }
  | { signedIn: true; known: true; name: string; email: string; team: boolean }
  | { signedIn: true; known: false };

/** The account's items of the profile menu, in order ("Sair" comes after them). */
export function accountItems(team: boolean): readonly NavLink[] {
  return team ? [...memberLinks, teamLink] : memberLinks;
}

/**
 * The main button on the right, signed in only. A visitor never sees "Criar meu site" in the
 * header (it only led to the sign-in page, E26): "Entrar ou cadastre-se" is their one way in,
 * and the home page keeps its own "Criar meu site" buttons in the hero and the sections.
 */
export function mainButton(session: HeaderSession): NavLink | null {
  return session.signedIn ? { href: CREATE_HREF, label: "Criar meu site", account: true } : null;
}

/** The current page among the middle links: only "Ajuda" is a page of its own. */
export function currentLink(pathname: string): string | null {
  return pathname === "/ajuda" ? "/ajuda" : null;
}

/** The address the visitor sees for an internal public variant ("/logado/ajuda" → "/ajuda"). */
export function visiblePath(pathname: string | null): string {
  const path = (pathname ?? "/").replace(/^\/(visitante|logado)(?=\/|$)/, "");
  return path === "" ? "/" : path;
}
