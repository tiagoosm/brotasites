import { describe, expect, it } from "vitest";
import { yearProblem, yearText, yearValue } from "./year-input";

describe("the year a business started (E38)", () => {
  it("keeps every step of what is typed, and gives the draft a year only at 4 digits", () => {
    const steps = ["1", "19", "199", "1998"].map((typed) => {
      const text = yearText(typed);
      return [text, yearValue(text)];
    });
    expect(steps).toEqual([
      ["1", undefined],
      ["19", undefined],
      ["199", undefined],
      ["1998", 1998],
    ]);
  });

  it("clears the year when everything is erased", () => {
    expect(yearText("")).toBe("");
    expect(yearValue("")).toBeUndefined();
  });

  it("drops what is not a digit and stops at 4", () => {
    expect(yearText(" 19a9-8 ")).toBe("1998");
    expect(yearText("199812")).toBe("1998");
  });

  it("says nothing while typing, and asks for 4 digits on leaving the field", () => {
    expect(yearProblem("199", false)).toBeNull();
    expect(yearProblem("199", true)).toBe("Use 4 números, como 1998.");
    expect(yearProblem("", true)).toBeNull();
  });

  it("uses the schema's own messages for a whole year out of range", () => {
    expect(yearProblem("1850", false)).toBe("Confira o ano.");
    expect(yearProblem(String(new Date().getFullYear() + 1), false)).toBe(
      "O ano não pode estar no futuro.",
    );
    expect(yearProblem("1998", true)).toBeNull();
  });
});
