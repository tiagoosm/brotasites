// Type scales: a modular scale whose steps grow fluidly from a 360 px to a 1280 px viewport.
// The jump between title and text is the main lever ("a large scale jump"); the display step is
// for the giant business name some heroes use.

export interface TypeScale {
  id: string;
  /** Ratio between steps on a phone and on a desktop. */
  ratioMin: number;
  ratioMax: number;
  /** Body size in px on a phone and on a desktop. */
  baseMin: number;
  baseMax: number;
  headingLineHeight: number;
  headingTracking: string;
  /** Extra multiplier for the display step (giant name). */
  displayBoost: number;
}

export const typeScales: readonly TypeScale[] = [
  {
    id: "gentle",
    ratioMin: 1.2,
    ratioMax: 1.25,
    baseMin: 16,
    baseMax: 18,
    headingLineHeight: 1.12,
    headingTracking: "-0.01em",
    displayBoost: 1.2,
  },
  {
    id: "editorial",
    ratioMin: 1.22,
    ratioMax: 1.333,
    baseMin: 16,
    baseMax: 18,
    headingLineHeight: 1.05,
    headingTracking: "-0.02em",
    displayBoost: 1.4,
  },
  {
    id: "dramatic",
    ratioMin: 1.25,
    ratioMax: Math.SQRT2,
    baseMin: 16,
    baseMax: 18,
    headingLineHeight: 0.98,
    headingTracking: "-0.03em",
    displayBoost: 1.6,
  },
  {
    id: "punchy",
    ratioMin: 1.25,
    ratioMax: 1.5,
    baseMin: 17,
    baseMax: 19,
    headingLineHeight: 0.95,
    headingTracking: "-0.02em",
    displayBoost: 1.5,
  },
];

/** Steps from -1 (small print) to 5 (h1); "display" is the giant name. */
export const scaleSteps = [-1, 0, 1, 2, 3, 4, 5] as const;

const VIEW_MIN = 360;
const VIEW_MAX = 1280;

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** clamp() that grows linearly from `min` px at 360 px wide to `max` px at 1280 px. */
export function fluid(min: number, max: number): string {
  const slope = (max - min) / (VIEW_MAX - VIEW_MIN);
  const intercept = min - slope * VIEW_MIN;
  return `clamp(${round(min / 16)}rem, ${round(intercept / 16)}rem + ${round(slope * 100, 3)}vw, ${round(max / 16)}rem)`;
}

/** Font size of a step in px on a phone and on a desktop. */
export function stepSize(scale: TypeScale, step: number): [number, number] {
  return [scale.baseMin * scale.ratioMin ** step, scale.baseMax * scale.ratioMax ** step];
}

/** CSS variables --step--1 ... --step-5 and --step-display. */
export function scaleVariables(scale: TypeScale): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const step of scaleSteps) {
    const [min, max] = stepSize(scale, step);
    variables[`--step-${step}`] = fluid(min, max);
  }
  const [min, max] = stepSize(scale, 5);
  // The giant name must still fit a 360 px screen: its phone size grows less than the desktop one.
  variables["--step-display"] = fluid(min * 1.1, max * scale.displayBoost);
  variables["--heading-line-height"] = String(scale.headingLineHeight);
  variables["--heading-tracking"] = scale.headingTracking;
  return variables;
}
