import { describe, expect, it } from "vitest";
import { lerpAngle, normalize, pointerAngle, resumeDelay, shortestDelta } from "./angle";
import { MAX_RUNNING, planEntrances, STAGGER_CAP, shouldReset } from "./reveal";
import { easeInOut, MAX_MS, MIN_MS, scrollDuration, scrollTarget, sectionOf } from "./scroll";
import { BURSTS, easeOut, isTypingField, MAX_SPARKS, sparksAllowed, strokeAt } from "./sparks";
import { centerlinePath, cubicAt, midpoints, mirrorPath, outlinePath, stemSegments } from "./stem";
import { onScreen, outermost, type Rect, rectDistance, vineAlpha } from "./vine";

describe("the price card's glow angle", () => {
  it("turns the short way round", () => {
    expect(shortestDelta(350, 10)).toBe(20);
    expect(shortestDelta(10, 350)).toBe(-20);
    expect(lerpAngle(350, 10, 0.5)).toBe(360);
    expect(normalize(lerpAngle(350, 10, 1))).toBe(10);
    expect(shortestDelta(0, 180)).toBe(180);
  });

  it("points up at 0deg and resumes the spin from where it stopped", () => {
    expect(pointerAngle(0, -1)).toBe(0);
    expect(pointerAngle(1, 0)).toBe(90);
    expect(pointerAngle(-1, 0)).toBe(270);
    expect(resumeDelay(90, 12_000)).toBe(-3000);
    expect(resumeDelay(-90, 12_000)).toBe(-9000);
  });
});

describe("the smooth scroll to a section", () => {
  it("lasts longer the farther it goes, within 600 to 900 ms", () => {
    expect(scrollDuration(0)).toBe(MIN_MS);
    expect(scrollDuration(1200)).toBe(750);
    expect(scrollDuration(-1200)).toBe(750);
    expect(scrollDuration(50_000)).toBe(MAX_MS);
  });

  it("eases in and out", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
  });

  it("stops under the header, inside the page, only for the home page's sections", () => {
    expect(scrollTarget(500, 1000, 64, 10_000)).toBe(1436);
    expect(scrollTarget(-2000, 100, 64, 10_000)).toBe(0);
    expect(scrollTarget(9000, 2000, 64, 10_000)).toBe(10_000);
    expect(sectionOf("/#preco")).toBe("preco");
    expect(sectionOf("#como-funciona")).toBe("como-funciona");
    expect(sectionOf("/ajuda")).toBeNull();
    expect(sectionOf("#conteudo")).toBeNull();
    expect(sectionOf(null)).toBeNull();
  });
});

describe("repeated entrances", () => {
  const box = (top: number, bottom = top + 100) => ({ top, bottom });

  it("resets only once fully off screen by the margin", () => {
    expect(shouldReset(box(500), 800)).toBe(false);
    expect(shouldReset(box(850), 800)).toBe(false);
    expect(shouldReset(box(1000), 800)).toBe(true);
    expect(shouldReset(box(-200, -100), 800)).toBe(false);
    expect(shouldReset(box(-400, -200), 800)).toBe(true);
  });

  it("animates a few one after the other, and shows the rest at once", () => {
    const many = Array.from({ length: 12 }, (_, i) => box(100 + i * 10));
    const plan = planEntrances(many, { running: 0, jumping: false });
    const animated = plan.filter((step) => step.mode === "animate");
    expect(animated).toHaveLength(MAX_RUNNING);
    expect(plan.slice(MAX_RUNNING).every((step) => step.mode === "instant")).toBe(true);
    expect(Math.max(...animated.map((step) => (step.mode === "animate" ? step.index : 0)))).toBe(
      STAGGER_CAP,
    );
    expect(planEntrances([box(100)], { running: MAX_RUNNING, jumping: false })[0]?.mode).toBe(
      "instant",
    );
  });

  it("shows at once during a jump and what was already scrolled past", () => {
    expect(
      planEntrances([box(100), box(300)], { running: 0, jumping: true }).map((s) => s.mode),
    ).toEqual(["instant", "instant"]);
    expect(planEntrances([box(-300, -10)], { running: 0, jumping: false })[0]?.mode).toBe(
      "instant",
    );
  });
});

describe("the stem's geometry", () => {
  const segments = stemSegments([100, 300, 500], 22, 8, 10);

  it("passes through every question's anchor, bending to alternate sides", () => {
    expect(segments).toHaveLength(3);
    expect(segments.map((s) => s.to)).toEqual([
      { x: 22, y: 100 },
      { x: 22, y: 300 },
      { x: 22, y: 500 },
    ]);
    const [first, second] = midpoints(segments);
    expect(first?.dx).toBeCloseTo(7.5, 1);
    expect(second?.dx).toBeCloseTo(-7.5, 1);
    expect(second?.dy).toBe(100);
    expect(cubicAt(segments[1] as (typeof segments)[number], 0)).toEqual({ x: 22, y: 100 });
  });

  it("draws the centre line and a closed, tapering body", () => {
    expect(centerlinePath(segments).startsWith("M22 8C")).toBe(true);
    const body = outlinePath(segments, 4, 1);
    expect(body.startsWith("M")).toBe(true);
    expect(body.endsWith("Z")).toBe(true);
    // Wider at the base (top) than at the tip.
    const numbers = body
      .slice(1, -1)
      .split("L")
      .map((pair) => pair.split(" ").map(Number));
    const first = numbers[0] as number[];
    const last = numbers.at(-1) as number[];
    expect(Math.abs((first[0] as number) - (last[0] as number))).toBeCloseTo(4, 0);
    expect(stemSegments([], 22, 8, 10)).toEqual([]);
  });

  it("mirrors a leaf for the left side", () => {
    expect(mirrorPath("M0 12C6 1 25-1 34 10Z", 40)).toBe("M40 12C34 1 15 -1 6 10Z");
  });
});

describe("where the mouse vine may show", () => {
  const card: Rect = [100, 100, 300, 200];

  it("is hidden over content and fades in a few px away", () => {
    expect(rectDistance(200, 150, card)).toBeLessThan(0);
    expect(vineAlpha(200, 150, [card])).toBe(0);
    expect(vineAlpha(305, 150, [card])).toBeGreaterThan(0);
    expect(vineAlpha(305, 150, [card])).toBeLessThan(1);
    expect(vineAlpha(400, 400, [card])).toBe(1);
  });

  it("keeps the outermost boxes and only those on screen", () => {
    const inner: Rect = [120, 120, 200, 140];
    expect(outermost([card, inner])).toEqual([card]);
    expect(outermost([card, [...card] as Rect])).toHaveLength(1);
    const header: Rect = [0, 0, 1280, 64];
    const page: Rect[] = [card, [0, 2000, 500, 2100]];
    expect(onScreen(page, [header], 0, 800)).toEqual([header, card]);
    expect(onScreen(page, [header], 1500, 800)).toEqual([header, [0, 500, 500, 600]]);
  });
});

describe("click sparks (E31)", () => {
  it("never shows in the team's area", () => {
    expect(sparksAllowed("/", "brotasites.com.br", "admin.brotasites.com.br")).toBe(true);
    expect(sparksAllowed("/admin", "brotasites.com.br", null)).toBe(false);
    expect(sparksAllowed("/admin/sites/1", "localhost:3000", null)).toBe(false);
    expect(sparksAllowed("/administrador", "localhost:3000", null)).toBe(true);
    expect(sparksAllowed("/entrar", "Admin.BrotaSites.com.br:443", "admin.brotasites.com.br")).toBe(
      false,
    );
  });

  it("skips fields people type in, keeps the ones they press", () => {
    for (const type of [null, "text", "password", "email", "search", "tel", "number"]) {
      expect(isTypingField("INPUT", type, false), String(type)).toBe(true);
    }
    expect(isTypingField("TEXTAREA", null, false)).toBe(true);
    expect(isTypingField("SELECT", null, false)).toBe(true);
    expect(isTypingField("DIV", null, true)).toBe(true);
    for (const type of ["checkbox", "radio", "submit", "button"]) {
      expect(isTypingField("INPUT", type, false), type).toBe(false);
    }
    expect(isTypingField("BUTTON", null, false)).toBe(false);
  });

  it("bursts within the agreed sizes, fewer and shorter on touch", () => {
    const { mouse, touch } = BURSTS;
    expect(mouse.count).toBeGreaterThanOrEqual(6);
    expect(mouse.count).toBeLessThanOrEqual(8);
    expect(mouse.length).toEqual([8, 14]);
    expect(mouse.travel).toEqual([18, 28]);
    expect(mouse.duration).toEqual([450, 600]);
    expect(touch.count).toBeLessThan(mouse.count);
    expect(touch.duration[1]).toBeLessThan(mouse.duration[1]);
    expect(MAX_SPARKS).toBe(40);
  });

  it("flies out, shortens, thins and fades to nothing", () => {
    const start = strokeAt(0, 12, 24);
    const middle = strokeAt(0.5, 12, 24);
    const end = strokeAt(1, 12, 24);
    expect(start.outer - start.inner).toBe(12);
    expect(middle.inner).toBeGreaterThan(start.inner);
    expect(middle.outer - middle.inner).toBeLessThan(12);
    expect(middle.width).toBeLessThan(start.width);
    expect(end.alpha).toBe(0);
    expect(end.inner).toBeCloseTo(27);
    // Ease-out: more than half the way at half the time.
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });
});
