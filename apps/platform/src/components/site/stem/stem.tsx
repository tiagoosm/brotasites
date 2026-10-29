import { formSteps12 as formSteps } from "@brotasites/schema/v1.2";
import { stemNotes } from "@/content/stem";
import { defaultStem, mirrorPath } from "@/lib/motion/stem";
import { excerpts } from "./excerpts";
import { StemGeometry } from "./stem-geometry";

// The home page's signature (E18): the seven questions hang off one curved stem that is drawn
// as the visitor scrolls (a CSS scroll-driven animation of the ink in globals.css). It snakes
// gently between the questions, thick and dark at the base, thin and lighter at the young tip.
// When the tip of the ink reaches a question, its leaf (and the small leaflets on the way)
// buds, grows and opens with a little sway, and the question enters (motion-reveal.tsx); the
// last one blooms. The server draws an even stem; stem-geometry.tsx redraws it through the
// real positions of the questions. Fully grown and open without support, without JavaScript
// or with reduced motion. All decoration is aria-hidden: the list stays a plain <ol>.

/** Four leaf shapes, drawn by hand, 40 x 24 units, base at (0, 12), tip to the right. */
const LEAVES = [
  {
    body: "M0 12C10 3 28 2 40 11C29 17 11 21 0 12Z",
    face: "M0 12C10 3 28 2 40 11C26 10 12 11 0 12Z",
    rib: "M1 12Q18 9.5 37 10.6",
  },
  {
    body: "M0 12C6 1 25-1 34 10C27 21 8 23 0 12Z",
    face: "M0 12C6 1 25-1 34 10C22 9 10 10 0 12Z",
    rib: "M1 12Q15 9 31 10",
  },
  {
    body: "M0 12C8 3 20 1 30 5C35 7 38 10 40 12C33 16 21 21 0 12Z",
    face: "M0 12C8 3 20 1 30 5C35 7 38 10 40 12C25 11 12 11 0 12Z",
    rib: "M1 12Q20 8 38 11.5",
  },
  {
    body: "M0 12C12 6 26 2 40 3C31 12 15 19 0 12Z",
    face: "M0 12C12 6 26 2 40 3C28 7 14 10 0 12Z",
    rib: "M1 12Q20 7 38 3.6",
  },
] as const;

interface LeafProps {
  shape: number;
  /** 1: to the right of the stem, -1: to the left. */
  side: 1 | -1;
  /** Size, as a fraction of 40 x 24 px. */
  size: number;
  /** The angle it rests at once open (degrees, negative points up). */
  angle: number;
  /** Where on the anchor line it grows: px below the anchor's top, px sideways from the stem. */
  y: string;
  x?: string;
  kind: "leaf" | "leaflet";
}

function Leaf({ shape, side, size, angle, y, x = "0px", kind }: LeafProps) {
  const drawn = LEAVES[shape % LEAVES.length] as (typeof LEAVES)[number];
  // Leaves on the left are mirrored in their path data, so CSS can turn them freely.
  const leaf =
    side === 1
      ? drawn
      : {
          body: mirrorPath(drawn.body, 40),
          face: mirrorPath(drawn.face, 40),
          rib: mirrorPath(drawn.rib, 40),
        };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 24"
      className={`stem-leaf stem-${kind}`}
      data-side={side === 1 ? "right" : "left"}
      style={
        {
          "--leaf-size": size,
          "--leaf-angle": `${angle}deg`,
          "--leaf-y": y,
          "--leaf-x": x,
        } as React.CSSProperties
      }
    >
      <g className="stem-leaf-sway">
        <path d={leaf.body} fill="var(--leaf)" />
        <path d={leaf.face} fill="var(--leaf-wash)" opacity=".55" />
        <path
          d={leaf.rib}
          fill="none"
          stroke="var(--stem)"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity=".75"
        />
      </g>
    </svg>
  );
}

/** A curl of tendril: a thin spiral off the stem. */
function Tendril({ side, y, x }: { side: 1 | -1; y: string; x: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="stem-leaf stem-tendril"
      data-side={side === 1 ? "right" : "left"}
      style={
        {
          "--leaf-size": 0.55,
          "--leaf-angle": "0deg",
          "--leaf-y": y,
          "--leaf-x": x,
        } as React.CSSProperties
      }
    >
      <path
        d={
          side === 1
            ? "M0 12C6 12 10 9 11 5C12 1 7 0 6 4C5 7 9 8 10 6"
            : "M24 12C18 12 14 9 13 5C12 1 17 0 18 4C19 7 15 8 14 6"
        }
        fill="none"
        stroke="var(--stem)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Each question's leaf: alternating sides, shapes, sizes and angles, never a row of twins. */
const PLAN: { side: 1 | -1; shape: number; size: number; angle: number; tendril?: boolean }[] = [
  { side: 1, shape: 0, size: 0.8, angle: -28 },
  { side: -1, shape: 1, size: 0.5, angle: -34 },
  { side: 1, shape: 2, size: 0.74, angle: -18, tendril: true },
  { side: -1, shape: 3, size: 0.52, angle: -24 },
  { side: 1, shape: 1, size: 0.7, angle: -36 },
  { side: -1, shape: 0, size: 0.48, angle: -20, tendril: true },
  { side: 1, shape: 3, size: 0.78, angle: -26 },
];

const FIRST_DRAWING = defaultStem(formSteps.length + 1, 56, 1000, 22, 11);

export function Stem() {
  return (
    <ol
      className="stem relative grid gap-20 pl-14 sm:gap-24 sm:pl-20"
      aria-label="As sete perguntas"
    >
      <svg
        aria-hidden="true"
        className="stem-svg"
        viewBox={`0 0 ${FIRST_DRAWING.width} ${FIRST_DRAWING.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="stem-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--stem)" />
            <stop offset="0.7" stopColor="var(--leaf-deep)" />
            <stop offset="1" stopColor="var(--leaf)" />
          </linearGradient>
          <mask id="stem-ink" maskUnits="userSpaceOnUse">
            <path className="stem-ink-line" d={FIRST_DRAWING.centerline} pathLength={1} />
          </mask>
        </defs>
        <path className="stem-guide" d={FIRST_DRAWING.centerline} />
        <path className="stem-body" d={FIRST_DRAWING.outline} mask="url(#stem-ink)" />
      </svg>
      {formSteps.map((step, index) => {
        const Excerpt = excerpts[step.slug];
        const plan = PLAN[index % PLAN.length] as (typeof PLAN)[number];
        const mid = FIRST_DRAWING.midpoints[index];
        // The leaflet in the gap above the question grows on the outside of the stem's bend.
        const outer: 1 | -1 = (mid?.dx ?? 0) >= 0 ? 1 : -1;
        return (
          <li
            key={step.slug}
            data-reveal="stem"
            className="stem-node relative grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-14"
            style={{ "--mid-dx": `${mid?.dx ?? 0}px` } as React.CSSProperties}
          >
            <span className="stem-anchor" aria-hidden="true">
              {index > 0 && (
                <Leaf
                  kind="leaflet"
                  shape={(plan.shape + 2) % LEAVES.length}
                  side={outer}
                  size={0.42}
                  angle={-40}
                  y="calc(var(--stem-gap) / -2)"
                  x="var(--mid-dx)"
                />
              )}
              {plan.tendril && (
                <Tendril
                  side={(outer * -1) as 1 | -1}
                  y="calc(var(--stem-gap) / -2.6)"
                  x="var(--mid-dx)"
                />
              )}
              <Leaf
                kind="leaf"
                shape={plan.shape}
                side={plan.side}
                size={plan.size}
                angle={plan.angle}
                y="0px"
              />
            </span>
            <div className="grid gap-3">
              <p className="tag text-stem">
                Pergunta {index + 1} de {formSteps.length} · {step.title}
              </p>
              <h3 className="font-display text-[1.875rem] leading-[1.1] sm:text-[2.25rem]">
                {step.question}
              </h3>
              <p className="max-w-[44ch] text-[1.0625rem] text-ink-soft">{stemNotes[step.slug]}</p>
            </div>
            <Excerpt />
          </li>
        );
      })}
      <li data-reveal="stem" className="stem-node relative grid gap-2">
        <span className="stem-anchor" aria-hidden="true">
          <svg viewBox="-16 -16 32 32" aria-hidden="true" className="stem-bloom">
            <circle className="stem-bloom-glow" r="15" fill="var(--pollen)" opacity=".18" />
            {[0, 72, 144, 216, 288].map((turn, i) => (
              <path
                key={turn}
                className="stem-petal"
                d="M0 0C-4-4-4-10 0-13C4-10 4-4 0 0Z"
                fill={i % 2 ? "var(--leaf)" : "var(--leaf-deep)"}
                style={{ "--petal-turn": `${turn}deg`, "--petal-index": i } as React.CSSProperties}
              />
            ))}
            <circle r="3" fill="var(--pollen)" />
          </svg>
        </span>
        <p className="font-display text-[1.875rem] leading-tight sm:text-[2.25rem]">
          Pronto. Seu site no ar.
        </p>
      </li>
      <StemGeometry />
    </ol>
  );
}
