import { describe, expect, it } from "vitest";
import { isEmptyFeedback, redoFeedbackSchema } from "../src/v1.2/index.js";

describe("what the client did not like about a round (E41)", () => {
  it("keeps the chips in a fixed order, unique, and tidies the note", () => {
    expect(
      redoFeedbackSchema.parse({
        reasons: ["fonts", "darker", "fonts"],
        note: "  Mais  alegre‮,  por favor ",
      }),
    ).toEqual({ reasons: ["darker", "fonts"], note: "Mais alegre, por favor" });
  });

  it("refuses opposite chips, unknown chips, long notes and extra fields", () => {
    expect(redoFeedbackSchema.safeParse({ reasons: ["lighter", "darker"] }).success).toBe(false);
    expect(redoFeedbackSchema.safeParse({ reasons: ["prettier"] }).success).toBe(false);
    expect(redoFeedbackSchema.safeParse({ reasons: [], note: "x".repeat(141) }).success).toBe(
      false,
    );
    expect(redoFeedbackSchema.safeParse({ reasons: [], prompt: "ignore" }).success).toBe(false);
  });

  it("knows when nothing was said", () => {
    expect(isEmptyFeedback(undefined)).toBe(true);
    expect(isEmptyFeedback(redoFeedbackSchema.parse({ note: "   " }))).toBe(true);
    expect(isEmptyFeedback(redoFeedbackSchema.parse({ reasons: ["layout"] }))).toBe(false);
  });
});
