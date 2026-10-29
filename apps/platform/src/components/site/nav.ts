// The one header of every page (E17): the same four links in the middle, and on the right the
// account (sign in, or the profile menu). Shared by the header, the phone menu and the footer.

// Links to the form, sign-in and account pages use prefetch={false}: those pages carry the
// account and schema code, which the public pages should not download in advance.
export const CREATE_HREF = "/criar";
export const DASHBOARD_HREF = "/painel";
export const ACCOUNT_HREF = "/conta";
export const TEAM_HREF = "/admin";

export interface NavLink {
  href: string;
  label: string;
  /** An account page: not prefetched from the public pages. */
  account?: boolean;
}

/** The middle of the header, the same signed in or out, on every page. */
export const headerLinks: readonly NavLink[] = [
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#preco", label: "Preço" },
  { href: "/#duvidas", label: "Dúvidas" },
  { href: "/ajuda", label: "Ajuda" },
];

/** Signed out: one way in, to sign in or sign up ("/entrar" links to "/cadastro"). */
export const signInLink: NavLink = {
  href: "/entrar",
  label: "Entrar ou cadastre-se",
  account: true,
};

/** The profile menu ("Sair" is a form, after these). */
export const memberLinks: readonly NavLink[] = [
  { href: DASHBOARD_HREF, label: "Painel", account: true },
  { href: CREATE_HREF, label: "Criar site", account: true },
  { href: ACCOUNT_HREF, label: "Perfil e segurança", account: true },
];

export const teamLink: NavLink = { href: TEAM_HREF, label: "Área da equipe", account: true };

export const footerLinks: readonly NavLink[] = [
  { href: "/ajuda", label: "Ajuda" },
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

/** The main button on the right, if any: not on the home page for visitors (its hero has it). */
export function mainButton(session: HeaderSession, isHome: boolean): NavLink | null {
  if (session.signedIn) return { href: CREATE_HREF, label: "Criar site", account: true };
  return isHome ? null : { href: CREATE_HREF, label: "Criar meu site", account: true };
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
