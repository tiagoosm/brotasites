import { describe, expect, it } from "vitest";
import { checkFacts, checkStyle, playbookFor } from "../src/index.js";

const source = {
  texts: [
    "Padaria do Zé",
    "Santa Rita do Sapucaí",
    "Rua das Flores",
    "123",
    "Centro",
    "Padaria de bairro com pães de fermentação natural desde 1998.",
    "seg, ter: 06:00–19:00",
    "R$ 12,90",
    "Bolos com 2 dias de antecedência",
    "5535999990000",
  ],
};
const kinds = (fields: Record<string, string>) =>
  checkFacts(fields, source).map((issue) => issue.kind);

describe("checkFacts", () => {
  it("accepts facts from the data, written another way", () => {
    expect(
      checkFacts(
        {
          a: "Desde 1998 na Rua das Flores, no Centro de Santa Rita do Sapucaí.",
          b: "Abrimos às 6h. Pão por R$ 12,90.",
          c: "Encomende com 2 dias de antecedência pela Padaria do Zé.",
          d: "Chame no WhatsApp: (35) 99999-0000",
        },
        source,
      ),
    ).toEqual([]);
  });

  it("rejects numbers, years and number words that are not in the data", () => {
    expect(kinds({ a: "Desde 1985 no bairro." })).toContain("number");
    expect(kinds({ a: "Mais de 10 mil clientes." })).toEqual(
      expect.arrayContaining(["number", "number-word"]),
    );
    expect(kinds({ a: "Trinta tipos de pão." })).toContain("number-word");
    expect(kinds({ a: "Ligue (11) 98888-7777." })).toContain("number");
  });

  it("rejects links, emails and handles the client did not give", () => {
    expect(kinds({ a: "Veja em www.example.org" })).toContain("link");
    expect(kinds({ a: "Acesse https://padaria.com" })).toContain("link");
    expect(kinds({ a: "Escreva para pedidos@outra.com.br" })).toContain("email");
    expect(kinds({ a: "Siga @outrapadaria" })).toContain("handle");
  });

  it("rejects awards, rankings and names that are not in the data", () => {
    expect(kinds({ a: "Eleita a melhor padaria." })).toContain("claim");
    expect(kinds({ a: "Pão premiado." })).toContain("claim");
    expect(kinds({ a: "O pão da Dona Maria Souza." })).toContain("name");
    expect(kinds({ a: "Pão fresco, de segunda a Sábado, também no Natal." })).toEqual([]);
  });
});

describe("checkStyle", () => {
  const { banned } = playbookFor("food");
  const hero = ["h.title", "h.subtitle"];

  it("flags banned phrases from the common rules and the family playbook", () => {
    const issues = checkStyle(
      { "h.title": "Venha conhecer a Padaria do Zé", x: "Um sabor inigualável" },
      banned,
      ["Padaria do Zé"],
      hero,
    );
    expect(issues.map((issue) => issue.value)).toEqual(["venha conhecer", "sabor inigualavel"]);
  });

  it("flags a hero with no fact of the business, and exclamation marks", () => {
    const generic = checkStyle(
      { "h.title": "Qualidade todos os dias", "h.subtitle": "" },
      banned,
      ["Padaria do Zé", "Centro"],
      hero,
    );
    expect(generic.map((issue) => issue.kind)).toEqual(["generic"]);
    const loud = checkStyle({ "h.title": "Pão no Centro!", a: "Venha!" }, banned, ["Centro"], hero);
    expect(loud.map((issue) => issue.kind)).toEqual(["exclamation", "exclamation"]);
  });
});
