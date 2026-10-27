// Links shared by the site header, the phone menu and the footer.

// Links to the form and to sign-in use prefetch={false}: those pages carry the account and
// schema code, which the public pages should not download in advance.
export const CREATE_HREF = "/criar/negocio";

export const headerLinks = [
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/ajuda", label: "Ajuda" },
] as const;

// The phone menu (up to 768px): the home page's parts, help and sign in, then the main button.
export const phoneMenuLinks = [
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#preco", label: "Preço" },
  { href: "/#duvidas", label: "Dúvidas" },
  { href: "/ajuda", label: "Ajuda" },
  { href: "/entrar", label: "Entrar" },
] as const;

export const footerLinks = [
  { href: "/ajuda", label: "Ajuda" },
  { href: "/termos", label: "Termos de uso" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/entrar", label: "Entrar" },
] as const;
