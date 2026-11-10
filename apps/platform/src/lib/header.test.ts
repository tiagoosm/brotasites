import { describe, expect, it } from "vitest";
import {
  accountItems,
  currentLink,
  footerLinks,
  type HeaderSession,
  headerLinks,
  isAccountScreen,
  mainButton,
  signInLink,
  signUpLink,
  visiblePath,
  visitorButtons,
  withoutCurrent,
} from "@/components/site/nav";
import { initialsOf } from "./initials";
import { publicPages } from "./site-url";

describe("initials of the profile button", () => {
  it("takes the first and last names, skipping the small words", () => {
    expect(initialsOf("Zé da Padaria")).toBe("ZP");
    expect(initialsOf("Maria das Graças dos Santos")).toBe("MS");
    expect(initialsOf("ana maria")).toBe("AM");
    expect(initialsOf("Jean-Pierre Silva")).toBe("JS");
  });

  it("keeps accents and handles one word", () => {
    expect(initialsOf("Ágata Érica")).toBe("ÁÉ");
    expect(initialsOf("Íris")).toBe("Í");
    expect(initialsOf("  Zé  ")).toBe("Z");
  });

  it("is empty without a name (the button shows a person icon)", () => {
    expect(initialsOf("")).toBe("");
    expect(initialsOf(null)).toBe("");
    expect(initialsOf("  123 !! ")).toBe("");
  });
});

describe("what the header shows", () => {
  const visitor: HeaderSession = { signedIn: false };
  const member: HeaderSession = {
    signedIn: true,
    known: true,
    name: "Zé",
    email: "z@x.com",
    team: false,
  };
  const unknown: HeaderSession = { signedIn: true, known: false };

  it("always has the same three links in the middle (E29: no Dúvidas, Ajuda covers it)", () => {
    expect(headerLinks.map((link) => link.label)).toEqual(["Como funciona", "Preço", "Ajuda"]);
    expect(headerLinks.map((link) => link.href)).toEqual(["/#como-funciona", "/#preco", "/ajuda"]);
    expect(currentLink("/ajuda")).toBe("/ajuda");
    expect(currentLink("/")).toBeNull();
  });

  it("offers the main button by state", () => {
    // A visitor never sees "Criar meu site" in the header (E26), on any page.
    expect(mainButton(visitor)).toBeNull();
    expect(mainButton(member)?.label).toBe("Criar meu site");
    expect(mainButton(unknown)?.href).toBe("/criar");
  });

  it("puts the account in the profile menu, and the team link only for the team", () => {
    expect(accountItems(false).map((link) => link.label)).toEqual([
      "Meus sites",
      "Criar meu site",
      "Perfil e segurança",
    ]);
    expect(accountItems(true).map((link) => link.label)).toEqual([
      "Meus sites",
      "Criar meu site",
      "Perfil e segurança",
      "Área da equipe",
    ]);
  });

  it("offers the visitor Entrar and Criar conta, never the current screen (E30)", () => {
    expect(signInLink).toMatchObject({ href: "/entrar", label: "Entrar" });
    expect(signUpLink).toMatchObject({ href: "/cadastro", label: "Criar conta" });
    expect(visitorButtons("/")).toEqual({ signIn: true, signUp: true });
    expect(visitorButtons("/ajuda")).toEqual({ signIn: true, signUp: true });
    expect(visitorButtons("/entrar")).toEqual({ signIn: false, signUp: true });
    expect(visitorButtons("/cadastro")).toEqual({ signIn: true, signUp: false });
    expect(visitorButtons("/esqueci-senha")).toEqual({ signIn: false, signUp: false });
    expect(visitorButtons("/redefinir-senha")).toEqual({ signIn: false, signUp: false });
  });

  it("keeps the footer to what the header lacks, and menus off the current page (E29)", () => {
    expect(footerLinks.map((link) => link.label)).toEqual(["Termos de uso", "Privacidade"]);
    for (const screen of ["/entrar", "/cadastro", "/esqueci-senha", "/redefinir-senha"]) {
      expect(isAccountScreen(screen)).toBe(true);
    }
    expect(isAccountScreen("/")).toBe(false);
    expect(isAccountScreen("/entrarx")).toBe(false);
    expect(withoutCurrent(accountItems(false), "/meus-sites").map((link) => link.label)).toEqual([
      "Criar meu site",
      "Perfil e segurança",
    ]);
    expect(withoutCurrent(headerLinks, "/ajuda").map((link) => link.label)).toEqual([
      "Como funciona",
      "Preço",
    ]);
  });

  it("reads the visible address of a prerendered public page", () => {
    expect(visiblePath("/visitante")).toBe("/");
    expect(visiblePath("/logado/ajuda")).toBe("/ajuda");
    expect(visiblePath("/meus-sites")).toBe("/meus-sites");
    expect(visiblePath("/logadox")).toBe("/logadox");
    expect(visiblePath(null)).toBe("/");
  });

  it("has no link to the removed example page", () => {
    const all = [...headerLinks, ...footerLinks, ...accountItems(true)].map((link) => link.href);
    expect(all.some((href) => href.startsWith("/exemplo"))).toBe(false);
    expect((publicPages as readonly string[]).some((page) => page.startsWith("/exemplo"))).toBe(
      false,
    );
  });
});
