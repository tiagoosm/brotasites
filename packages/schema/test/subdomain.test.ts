import { describe, expect, it } from "vitest";
import { subdomainSchema, suggestSubdomain } from "../src/index.js";

describe("suggestSubdomain", () => {
  it.each([
    ["Padaria do Zé", "padaria-do-ze"],
    ["Salão Beleza & Cia", "salao-beleza-e-cia"],
    ["  Barbearia   do Léo!  ", "barbearia-do-leo"],
    ["Café 24h", "cafe-24h"],
    ["Ótica São João Batista de Santa Rita do Sapucaí", "otica-sao-joao-batista-de-santa-rita-do"],
  ])("%s -> %s", (name, expected) => {
    const slug = suggestSubdomain(name);
    expect(slug).toBe(expected);
    expect(subdomainSchema.safeParse(slug).success).toBe(true);
  });

  it.each([undefined, "", "Zé", "!!"])("gives up on %s", (name) => {
    expect(suggestSubdomain(name)).toBeUndefined();
  });
});
