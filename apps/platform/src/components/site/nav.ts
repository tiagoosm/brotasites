// Links shared by the site header, the phone menu and the footer.

export const CREATE_HREF = "/criar/negocio";

export const headerLinks = [
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/ajuda", label: "Ajuda" },
] as const;

export const footerLinks = [
  { href: "/ajuda", label: "Ajuda" },
  { href: "/termos", label: "Termos de uso" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/entrar", label: "Entrar" },
] as const;
