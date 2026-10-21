import { describe, expect, it } from "vitest";
import { alternativeSubdomain, localSubdomainProblem, tidySubdomain } from "./publication";

describe("site address", () => {
  it("tidies what is typed into a valid address", () => {
    expect(tidySubdomain("Zé Doces")).toBe("ze-doces");
    expect(tidySubdomain("padaria__do..zé!")).toBe("padaria-do-ze");
    expect(tidySubdomain("a".repeat(50))).toHaveLength(40);
  });

  it("explains addresses that cannot be used", () => {
    expect(localSubdomainProblem("padaria-do-ze")).toBeNull();
    expect(localSubdomainProblem("ab")).toMatch(/de 3 a 40 caracteres/);
    expect(localSubdomainProblem("-padaria")).toMatch(/sem começar ou terminar com hífen/);
    expect(localSubdomainProblem("painel")).toBe("Esse endereço é reservado. Escolha outro.");
  });

  it("offers the name with the city when an address is taken", () => {
    expect(alternativeSubdomain("padaria-do-ze", "Santa Rita do Sapucaí")).toBe(
      "padaria-do-ze-santa-rita-do-sapucai",
    );
    expect(alternativeSubdomain("padaria-do-ze", undefined)).toBeUndefined();
  });
});
