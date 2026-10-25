import { describe, expect, it } from "vitest";
import { readDemoHandoff } from "./demo-handoff";

const types = ["padaria", "barbearia"];

describe("demo handoff", () => {
  it("reads the name and a listed type", () => {
    expect(readDemoHandoff("?nome=Barbearia%20do%20L%C3%A9o&tipo=barbearia", types)).toEqual({
      name: "Barbearia do Léo",
      type: "barbearia",
    });
  });

  it("ignores unknown types, tidies and caps the name", () => {
    expect(readDemoHandoff(`?nome=${"a".repeat(120)}&tipo=cassino`, types)).toEqual({
      name: "a".repeat(80),
      type: undefined,
    });
    expect(readDemoHandoff("?nome=%20%20Z%C3%A9%20%20Doces%20", types).name).toBe("Zé Doces");
  });

  it("ignores names too short to be a name", () => {
    expect(readDemoHandoff("?nome=x", types)).toEqual({ name: undefined, type: undefined });
  });
});
