import { describe, expect, it } from "vitest";
import { chooseDraft, isEmptyDraft, type StoredDraft } from "./draft-sync";
import { safeNextPath } from "./supabase/env";

const empty: StoredDraft = { draft: {}, completed: [], updatedAt: 0 };
const answered = (updatedAt: number, name: string): StoredDraft => ({
  draft: { business: { name } },
  completed: ["negocio"],
  updatedAt,
});

describe("chooseDraft", () => {
  it("keeps local answers when the account has nothing yet", () => {
    expect(chooseDraft(answered(10, "Padaria"), null)).toBe("local");
    expect(chooseDraft(answered(10, "Padaria"), empty)).toBe("local");
  });

  it("brings the account's answers to a fresh device", () => {
    expect(chooseDraft(empty, answered(10, "Padaria"))).toBe("remote");
  });

  it("keeps the newer copy when both have answers", () => {
    expect(chooseDraft(answered(20, "Novo"), answered(10, "Velho"))).toBe("local");
    expect(chooseDraft(answered(10, "Velho"), answered(20, "Novo"))).toBe("remote");
  });

  it("knows an untouched draft", () => {
    expect(isEmptyDraft(empty)).toBe(true);
    expect(isEmptyDraft(answered(1, "x"))).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("only allows paths inside the platform", () => {
    expect(safeNextPath("/criar/cores")).toBe("/criar/cores");
    for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "", null]) {
      expect(safeNextPath(value)).toBe("/criar/negocio");
    }
  });
});
