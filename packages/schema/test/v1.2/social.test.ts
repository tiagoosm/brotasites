import { describe, expect, it } from "vitest";
import {
  facebookSchema,
  instagramSchema,
  normalizeSocial,
  socialProblem,
} from "../../src/v1.2/index.js";

// E38: "Informe só o nome de usuário do Instagram, sem @" showed for any text the rule refused,
// and some pasted links were saved as wrong names. Each case: what is pasted, the name kept and
// what the client is told (null: accepted). The schema gives the same message as the form.

const instagram: [string, string, string | null][] = [
  ["padariadoze", "padariadoze", null],
  ["padaria.doze", "padaria.doze", null],
  ["padaria_doze", "padaria_doze", null],
  [
    "padaria-doze",
    "padaria-doze",
    "Use só letras sem acento, números, ponto (.) e sublinhado (_).",
  ],
  ["padaria doze", "padaria doze", "O nome de usuário do Instagram não tem espaços."],
  ["padariadoze ", "padariadoze", null],
  ["PadariaDoze", "PadariaDoze", null],
  ["padariadozé", "padariadozé", "Use só letras sem acento, números, ponto (.) e sublinhado (_)."],
  ["a".repeat(31), "a".repeat(31), "O nome de usuário do Instagram tem no máximo 30 caracteres."],
  ["@padariadoze", "padariadoze", null],
  ["instagram.com/padariadoze", "padariadoze", null],
  ["https://www.instagram.com/padariadoze/", "padariadoze", null],
  // Before: saved as the name "m.instagram.com".
  ["m.instagram.com/padariadoze", "padariadoze", null],
  ["https://www.instagram.com/padariadoze?igsh=MXZ5bGd2", "padariadoze", null],
  ["https://instagram.com/padariadoze/?utm_source=ig_web", "padariadoze", null],
  ["padariadoze\n", "padariadoze", null],
  ["\n padariadoze \n", "padariadoze", null],
  [
    "https://www.facebook.com/padariadoze",
    "https://www.facebook.com/padariadoze",
    "Esse endereço parece ser do Facebook. Cole o link do Instagram ou só o nome de usuário.",
  ],
  [
    "www.padariadoze.com.br/contato",
    "www.padariadoze.com.br/contato",
    "Isso parece o endereço de um site. Informe só o nome de usuário do Instagram.",
  ],
  ["padaria@doze", "padaria@doze", "Informe o nome de usuário do Instagram sem @."],
];

const facebook: [string, string, string | null][] = [
  ["padariadoze", "padariadoze", null],
  ["Padaria.Do.Ze", "Padaria.Do.Ze", null],
  ["padaria-do-ze-123", "padaria-do-ze-123", null],
  ["facebook.com/padariadoze", "padariadoze", null],
  ["https://www.facebook.com/padariadoze/", "padariadoze", null],
  // Before: saved as the names "fb.com" and "m.facebook.com".
  ["fb.com/padariadoze", "padariadoze", null],
  ["m.facebook.com/padariadoze", "padariadoze", null],
  ["https://www.facebook.com/padariadoze?mibextid=ZbWKwL", "padariadoze", null],
  // Before: saved as the name "profile.php".
  [
    "https://www.facebook.com/profile.php?id=100012345",
    "profile.php",
    "Perfis do Facebook com número (profile.php) não são aceitos: use o nome da página.",
  ],
  ["padaria_doze", "padaria_doze", "Use só letras sem acento, números, ponto (.) e hífen (-)."],
  ["ab", "ab", "O nome da página do Facebook tem pelo menos 3 caracteres."],
  ["padaria do ze", "padaria do ze", "O nome de usuário do Facebook não tem espaços."],
  [
    "instagram.com/padariadoze",
    "instagram.com/padariadoze",
    "Esse endereço parece ser do Instagram. Cole o link do Facebook ou só o nome de usuário.",
  ],
];

describe("Instagram and Facebook names (E38)", () => {
  for (const [network, cases, schema] of [
    ["instagram", instagram, instagramSchema],
    ["facebook", facebook, facebookSchema],
  ] as const) {
    for (const [pasted, kept, message] of cases) {
      it(`${network}: ${JSON.stringify(pasted)}`, () => {
        const name = normalizeSocial(pasted, network);
        expect(name).toBe(kept);
        expect(socialProblem(name, network)).toBe(message);
        const parsed = schema.safeParse(name);
        expect(parsed.success).toBe(message === null);
        if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe(message);
      });
    }
  }

  it("never changes a name typed slowly, one letter at a time", () => {
    let typed = "";
    for (const letter of "padaria.doze") {
      typed += letter;
      expect(normalizeSocial(typed, "instagram")).toBe(typed);
    }
  });
});
