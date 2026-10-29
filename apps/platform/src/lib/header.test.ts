import { describe, expect, it } from "vitest";
import {
  accountItems,
  currentLink,
  footerLinks,
  type HeaderSession,
  headerLinks,
  mainButton,
  visiblePath,
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

  it("always has the same four links in the middle", () => {
    expect(headerLinks.map((link) => link.label)).toEqual([
      "Como funciona",
      "Preço",
      "Dúvidas",
      "Ajuda",
    ]);
    expect(headerLinks.map((link) => link.href)).toEqual([
      "/#como-funciona",
      "/#preco",
      "/#duvidas",
      "/ajuda",
    ]);
    expect(currentLink("/ajuda")).toBe("/ajuda");
    expect(currentLink("/")).toBeNull();
  });

  it("offers the main button by state", () => {
    expect(mainButton(visitor, false)?.label).toBe("Criar meu site");
    expect(mainButton(visitor, true)).toBeNull();
    expect(mainButton(member, true)?.label).toBe("Criar site");
    expect(mainButton(unknown, false)?.href).toBe("/criar");
  });

  it("puts the account in the profile menu, and the team link only for the team", () => {
    expect(accountItems(false).map((link) => link.label)).toEqual([
      "Painel",
      "Criar site",
      "Perfil e segurança",
    ]);
    expect(accountItems(true).map((link) => link.label)).toEqual([
      "Painel",
      "Criar site",
      "Perfil e segurança",
      "Área da equipe",
    ]);
  });

  it("reads the visible address of a prerendered public page", () => {
    expect(visiblePath("/visitante")).toBe("/");
    expect(visiblePath("/logado/ajuda")).toBe("/ajuda");
    expect(visiblePath("/painel")).toBe("/painel");
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
