import type { Random } from "./random.js";

// Original SVG ornaments, built from geometry (polygons, arcs, seeded curves) rather than
// drawn after any reference, so none of them copies third-party art. They paint with
// currentColor, carry no text (fact-based seals such as "Desde 1998" put the client's own
// data over them in the template) and never reference anything outside the SVG.

export interface OrnamentPart {
  d: string;
  /** "fill" paints the shape; "stroke" draws its outline. */
  kind: "fill" | "stroke";
  strokeWidth?: number;
  /** stroke-dasharray, for dotted threads. */
  dash?: string;
}

export interface Ornament {
  id: string;
  viewBox: string;
  parts: OrnamentPart[];
}

const r2 = (value: number) => Math.round(value * 100) / 100;

function polygon(points: [number, number][]): string {
  return `${points.map(([x, y], index) => `${index ? "L" : "M"}${r2(x)} ${r2(y)}`).join("")}Z`;
}

function radial(count: number, outer: number, inner: number, cx = 50, cy = 50): [number, number][] {
  const points: [number, number][] = [];
  for (let index = 0; index < count * 2; index++) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI * index) / count - Math.PI / 2;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return points;
}

function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
}

/** Smooth closed curve through the points (Catmull-Rom turned into cubic Béziers). */
function smoothClosed(points: [number, number][]): string {
  const n = points.length;
  const at = (index: number) => points[((index % n) + n) % n] as [number, number];
  let path = `M${r2(at(0)[0])} ${r2(at(0)[1])}`;
  for (let index = 0; index < n; index++) {
    const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    path += `C${r2(c1[0] as number)} ${r2(c1[1] as number)} ${r2(c2[0] as number)} ${r2(c2[1] as number)} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return `${path}Z`;
}

type Builder = (random: Random) => Ornament;

const builders: Record<string, Builder> = {
  // Toothed seal with an inner ring; the template writes a fact over it.
  seal: () => ({
    id: "seal",
    viewBox: "0 0 100 100",
    parts: [
      { d: polygon(radial(24, 49, 44)), kind: "fill" },
      { d: circle(50, 50, 36), kind: "stroke", strokeWidth: 1.5 },
    ],
  }),
  "star-burst": (random) => ({
    id: "star-burst",
    viewBox: "0 0 100 100",
    parts: [{ d: polygon(radial(random.int(10, 14), 49, random.range(30, 36))), kind: "fill" }],
  }),
  sparkle: () => ({
    id: "sparkle",
    viewBox: "0 0 100 100",
    parts: [{ d: "M50 2Q54 46 98 50Q54 54 50 98Q46 54 2 50Q46 46 50 2Z", kind: "fill" }],
  }),
  flower: (random) => {
    const petals = random.int(5, 8);
    const parts: OrnamentPart[] = [];
    for (let index = 0; index < petals; index++) {
      const angle = (360 / petals) * index;
      const rad = (angle * Math.PI) / 180;
      const [x, y] = [50 + 24 * Math.cos(rad), 50 + 24 * Math.sin(rad)];
      parts.push({ d: ellipse(x, y, 22, 13, angle), kind: "fill" });
    }
    parts.push({ d: circle(50, 50, 10), kind: "fill" });
    return { id: "flower", viewBox: "0 0 100 100", parts };
  },
  blob: (random) => {
    const count = 8;
    const points: [number, number][] = [];
    for (let index = 0; index < count; index++) {
      const angle = (Math.PI * 2 * index) / count;
      const radius = random.range(34, 47);
      points.push([50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)]);
    }
    return {
      id: "blob",
      viewBox: "0 0 100 100",
      parts: [{ d: smoothClosed(points), kind: "fill" }],
    };
  },
  // A loose hand-drawn arrow pointing right and down, for a handwritten note.
  "arrow-hand": (random) => {
    const wobble = () => r2(random.range(-4, 4));
    const end: [number, number] = [104, 52];
    return {
      id: "arrow-hand",
      viewBox: "0 0 120 70",
      parts: [
        {
          d: `M6 ${14 + wobble()}C${36 + wobble()} 2 ${70 + wobble()} 8 ${end[0]} ${end[1]}`,
          kind: "stroke",
          strokeWidth: 3,
        },
        {
          d: `M${88 + wobble()} 46L${end[0]} ${end[1]}L${100 + wobble()} 34`,
          kind: "stroke",
          strokeWidth: 3,
        },
      ],
    };
  },
  squiggle: () => {
    let d = "M2 20";
    for (let x = 2; x < 198; x += 24) d += `Q${x + 6} 4 ${x + 12} 20T${x + 24} 20`;
    return {
      id: "squiggle",
      viewBox: "0 0 200 40",
      parts: [{ d, kind: "stroke", strokeWidth: 3 }],
    };
  },
  "zigzag-line": () => {
    let d = "M2 30";
    for (let x = 2, up = true; x < 198; x += 14, up = !up) d += `L${x + 14} ${up ? 10 : 30}`;
    return {
      id: "zigzag-line",
      viewBox: "0 0 200 40",
      parts: [{ d, kind: "stroke", strokeWidth: 3 }],
    };
  },
  "arch-outline": () => ({
    id: "arch-outline",
    viewBox: "0 0 100 120",
    parts: [10, 22, 34].map((inset) => ({
      d: `M${inset} 118V${50 + inset * 0.2}A${50 - inset} ${50 - inset} 0 0 1 ${100 - inset} ${50 + inset * 0.2}V118`,
      kind: "stroke" as const,
      strokeWidth: 1.5,
    })),
  }),
  "grid-thin": () => {
    let d = "";
    for (let v = 0; v <= 100; v += 20) d += `M${v} 0V100M0 ${v}H100`;
    return {
      id: "grid-thin",
      viewBox: "0 0 100 100",
      parts: [{ d, kind: "stroke", strokeWidth: 0.6 }],
    };
  },
  // The dotted line that stitches sections together; drawn tall, the template stretches it.
  "dotted-thread": (random) => ({
    id: "dotted-thread",
    viewBox: "0 0 60 400",
    parts: [
      {
        d: `M30 0C${r2(random.range(0, 20))} 100 ${r2(random.range(40, 60))} 200 30 260S${r2(random.range(5, 25))} 360 30 400`,
        kind: "stroke",
        strokeWidth: 3,
        dash: "0 12",
      },
    ],
  }),
  "circle-ring": () => ({
    id: "circle-ring",
    viewBox: "0 0 100 100",
    parts: [
      { d: circle(50, 50, 46), kind: "stroke", strokeWidth: 1.5 },
      { d: circle(50, 50, 30), kind: "stroke", strokeWidth: 1.5 },
    ],
  }),
  "half-circles": () => ({
    id: "half-circles",
    viewBox: "0 0 200 50",
    parts: [0, 1, 2, 3].map((index) => ({
      d: `M${index * 50} 50A25 25 0 0 1 ${index * 50 + 50} 50Z`,
      kind: "fill" as const,
    })),
  }),
};

function ellipse(cx: number, cy: number, rx: number, ry: number, rotation: number): string {
  const rad = (rotation * Math.PI) / 180;
  const [dx, dy] = [rx * Math.cos(rad), rx * Math.sin(rad)];
  return `M${r2(cx - dx)} ${r2(cy - dy)}A${rx} ${ry} ${r2(rotation)} 1 0 ${r2(cx + dx)} ${r2(cy + dy)}A${rx} ${ry} ${r2(rotation)} 1 0 ${r2(cx - dx)} ${r2(cy - dy)}Z`;
}

export const ornamentIds = Object.keys(builders);

/** Builds an ornament; seeded ones (blob, arrow, flower) vary with the random source. */
export function buildOrnament(id: string, random: Random): Ornament {
  const builder = builders[id];
  if (!builder) throw new Error(`Unknown ornament: ${id}`);
  return builder(random);
}

export interface OrnamentSet {
  id: string;
  ornaments: readonly string[];
}

export const ornamentSets: readonly OrnamentSet[] = [
  { id: "seals", ornaments: ["seal", "star-burst", "sparkle"] },
  { id: "organic", ornaments: ["flower", "blob", "circle-ring"] },
  { id: "linear", ornaments: ["arch-outline", "grid-thin", "dotted-thread"] },
  { id: "playful", ornaments: ["squiggle", "zigzag-line", "star-burst", "arrow-hand"] },
  { id: "handmade", ornaments: ["arrow-hand", "dotted-thread", "sparkle"] },
  { id: "geometric", ornaments: ["half-circles", "circle-ring", "zigzag-line"] },
];

/** Inline SVG markup, decorative (hidden from screen readers), painted with currentColor. */
export function ornamentSvg(ornament: Ornament, className = ""): string {
  if (!/^[a-z0-9 -]*$/.test(className)) throw new Error(`Invalid class name: ${className}`);
  const parts = ornament.parts
    .map((part) =>
      part.kind === "fill"
        ? `<path fill="currentColor" d="${part.d}"/>`
        : `<path fill="none" stroke="currentColor" stroke-width="${part.strokeWidth ?? 2}" stroke-linecap="round" stroke-linejoin="round"${part.dash ? ` stroke-dasharray="${part.dash}"` : ""} d="${part.d}"/>`,
    )
    .join("");
  const classes = ["ornament", `ornament-${ornament.id}`, className].filter(Boolean).join(" ");
  return `<svg class="${classes}" viewBox="${ornament.viewBox}" aria-hidden="true" focusable="false">${parts}</svg>`;
}
