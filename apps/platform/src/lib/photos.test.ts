import { describe, expect, it } from "vitest";
import { fitWithin, photoPath } from "./photos";

describe("photos", () => {
  it("shrinks large photos to 2000px on the longest side", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1500, height: 2000 });
  });

  it("never enlarges small photos", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("stores photos in the person's own folder", () => {
    expect(photoPath("user-1", "site-1", "abc")).toBe("user-1/site-1/abc.webp");
  });
});
