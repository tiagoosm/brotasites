"use client";

import { type FormStepSlug, formSteps } from "@brotasites/schema";
import Link from "next/link";
import { useDraft } from "@/lib/draft-store";
import { cn } from "@/lib/utils";

// Herbarium signature: an ink stem drawn along the steps. The inked part grows to the
// current step, every finished step opens a leaf, and the current step carries a pollen bud.

const ROW = 56;
const STEM_X = 10;

function stemPath(rows: number): string {
  let d = `M${STEM_X} ${ROW / 2}`;
  for (let i = 1; i < rows; i++) {
    const y0 = ROW / 2 + ROW * (i - 1);
    const y1 = y0 + ROW;
    const sway = i % 2 ? 5 : -5;
    d += ` C ${STEM_X + sway} ${y0 + ROW / 3}, ${STEM_X - sway} ${y1 - ROW / 3}, ${STEM_X} ${y1}`;
  }
  return d;
}

function Leaf({ y, side, grown }: { y: number; side: "left" | "right"; grown: boolean }) {
  const transform =
    side === "right"
      ? `translate(${STEM_X + 1} ${y - 4}) rotate(-28)`
      : `translate(${STEM_X - 1} ${y - 4}) rotate(208)`;
  return (
    <g transform={transform}>
      <g className="leaf" data-grown={grown}>
        <path
          d="M0 0C6-8 17-9 24-3 17 3 7 4 0 0Z"
          fill="var(--leaf-wash)"
          stroke="var(--stem)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M1 0 21-3" stroke="var(--stem)" strokeWidth=".8" opacity=".7" />
      </g>
    </g>
  );
}

export function SproutProgress({ current }: { current: FormStepSlug }) {
  const { completed, isReachable } = useDraft();
  const currentIndex = formSteps.findIndex((step) => step.slug === current);
  const rows = formSteps.length;
  const height = rows * ROW;
  const d = stemPath(rows);
  const grownTo = Math.max(
    currentIndex,
    ...completed.map((slug) => formSteps.findIndex((s) => s.slug === slug)),
  );
  const progress = rows > 1 ? Math.max(0, grownTo) / (rows - 1) : 1;
  const allDone = completed.length === rows;

  return (
    <nav aria-label="Perguntas do formulário" className="relative">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        width={STEM_X * 2 + 4}
        height={height}
        viewBox={`0 0 ${STEM_X * 2 + 4} ${height}`}
      >
        <path
          d={d}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="1.4"
          strokeDasharray="2 5"
          strokeLinecap="round"
        />
        <path
          d={d}
          pathLength={1}
          className="stem-path"
          data-grown="true"
          style={{ strokeDashoffset: 1 - progress }}
          fill="none"
          stroke="var(--stem)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {formSteps.map((step, index) => (
          <Leaf
            key={step.slug}
            y={ROW / 2 + ROW * index}
            side={index % 2 === 0 ? "right" : "left"}
            grown={completed.includes(step.slug) && index !== currentIndex}
          />
        ))}
        {!allDone && currentIndex >= 0 && (
          <g transform={`translate(${STEM_X} ${ROW / 2 + ROW * currentIndex})`}>
            <circle className="bud-ring" r="9" fill="var(--pollen)" opacity=".25" />
            <circle r="5" fill="var(--pollen)" />
          </g>
        )}
      </svg>

      <ol className="grid">
        {formSteps.map((step, index) => {
          const active = index === currentIndex;
          const reachable = isReachable(step.slug);
          const content = (
            <>
              <span className="tag text-ink-soft">Pergunta {index + 1}</span>
              <span
                className={cn(
                  "text-[0.9375rem] leading-snug",
                  active ? "font-semibold text-ink" : "text-ink-soft",
                )}
              >
                {step.title}
              </span>
            </>
          );
          return (
            <li key={step.slug} className="flex" style={{ height: ROW }}>
              {reachable && !active ? (
                <Link
                  href={`/criar/${step.slug}`}
                  className="flex flex-col justify-center gap-0.5 rounded-md pl-9 transition-colors hover:text-ink"
                >
                  {content}
                </Link>
              ) : (
                <span
                  className={cn(
                    "flex flex-col justify-center gap-0.5 pl-9",
                    !reachable && "opacity-70",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Compact version for small screens: a horizontal stem that grows across the header. */
export function SproutProgressBar({ current }: { current: FormStepSlug }) {
  const { completed } = useDraft();
  const currentIndex = formSteps.findIndex((step) => step.slug === current);
  const step = formSteps[currentIndex];
  const rows = formSteps.length;
  const grownTo = Math.max(
    currentIndex,
    ...completed.map((slug) => formSteps.findIndex((s) => s.slug === slug)),
  );
  const width = 320;
  const x = (i: number) => 6 + ((width - 12) / (rows - 1)) * i;
  const d = `M6 9 C ${width * 0.25} 3, ${width * 0.5} 15, ${width * 0.75} 9 S ${width - 20} 5, ${width - 6} 9`;

  return (
    <div className="grid gap-2">
      <p className="text-sm text-ink-soft">
        <span className="font-semibold text-ink">
          Pergunta {currentIndex + 1} de {rows}
        </span>
        {step && ` · ${step.title}`}
      </p>
      {/* Uniform scaling only: pathLength-based drawing breaks with non-uniform stretch. */}
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${width} 18`}
        className="h-auto w-full overflow-visible"
      >
        <path
          d={d}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="1.4"
          strokeDasharray="2 5"
        />
        <path
          d={d}
          pathLength={1}
          className="stem-path"
          data-grown="true"
          style={{ strokeDashoffset: 1 - Math.max(0, grownTo) / (rows - 1) }}
          fill="none"
          stroke="var(--stem)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={x(Math.max(0, currentIndex))} cy="9" r="4.5" fill="var(--pollen)" />
      </svg>
    </div>
  );
}
