import { describe, expect, it } from "vitest";
import { formSteps12, knownSteps } from "../src/v1.2/index.js";

// E25: the form has 5 steps; drafts saved by the former 7-step form still read.

describe("the 5 steps", () => {
  it("are the 5 that ask for information, in order", () => {
    expect(formSteps12.map((step) => step.slug)).toEqual([
      "negocio",
      "marca",
      "secoes",
      "conteudo",
      "contato",
    ]);
  });

  it("drop the old steps 6 and 7 and anything unknown from a saved draft", () => {
    expect(
      knownSteps(["negocio", "marca", "secoes", "conteudo", "contato", "direcao", "endereco"]),
    ).toEqual(["negocio", "marca", "secoes", "conteudo", "contato"]);
    expect(knownSteps(["direcao", 3, null, "marca"])).toEqual(["marca"]);
    expect(knownSteps(null)).toEqual([]);
    expect(knownSteps(undefined)).toEqual([]);
  });
});
