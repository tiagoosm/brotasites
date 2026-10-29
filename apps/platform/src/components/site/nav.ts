// Links shared by the site header, the phone menu, the footer and the account pages.

// Links to the form, sign-in and account pages use prefetch={false}: those pages carry the
// account and schema code, which the public pages should not download in advance.
export const CREATE_HREF = "/criar";
export const DASHBOARD_HREF = "/painel";
export const ACCOUNT_HREF = "/conta";

export interface NavLink {
  href: string;
  label: string;
  /** An account page: not prefetched from the public pages. */
  account?: boolean;
}

export const headerLinks: readonly NavLink[] = [
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/ajuda", label: "Ajuda" },
];

/** Signed out: sign in and create the account. */
export const guestLinks: readonly NavLink[] = [
  { href: "/entrar", label: "Entrar", account: true },
  { href: "/cadastro", label: "Criar conta", account: true },
];

/** Signed in: the account's own menu ("Sair" is a form, after these). */
export const memberLinks: readonly NavLink[] = [
  { href: DASHBOARD_HREF, label: "Painel", account: true },
  { href: CREATE_HREF, label: "Criar site", account: true },
  { href: ACCOUNT_HREF, label: "Perfil e segurança", account: true },
];

// The phone menu (up to 768px): the home page's parts and help, then the account's links.
export const phoneMenuLinks: readonly NavLink[] = [
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#preco", label: "Preço" },
  { href: "/#duvidas", label: "Dúvidas" },
  { href: "/ajuda", label: "Ajuda" },
];

export const footerLinks: readonly NavLink[] = [
  { href: "/ajuda", label: "Ajuda" },
  { href: "/termos", label: "Termos de uso" },
  { href: "/privacidade", label: "Privacidade" },
];
