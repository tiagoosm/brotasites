// Background patterns in pure CSS (gradients only): no url(), so they pass the sites' CSP and
// cost no request. They paint with --pattern-color, a faint tint of the text color.

export interface Pattern {
  id: string;
  /** CSS `background` layers, or "none". */
  background: string;
}

const ink = "var(--pattern-color)";

export const patterns: readonly Pattern[] = [
  { id: "none", background: "none" },
  {
    id: "dots",
    background: `radial-gradient(${ink} 1.2px, transparent 1.7px) 0 0 / 22px 22px`,
  },
  {
    id: "grain-dots",
    background: `radial-gradient(${ink} 1px, transparent 1.5px) 0 0 / 18px 18px, radial-gradient(${ink} 1px, transparent 1.5px) 9px 9px / 18px 18px`,
  },
  {
    id: "grid-lines",
    background: `linear-gradient(${ink} 1px, transparent 1px) 0 0 / 56px 56px, linear-gradient(90deg, ${ink} 1px, transparent 1px) 0 0 / 56px 56px`,
  },
  {
    id: "diagonal",
    background: `repeating-linear-gradient(45deg, ${ink} 0 1px, transparent 1px 14px)`,
  },
  {
    id: "checker",
    background: `conic-gradient(${ink} 25%, transparent 0 50%, ${ink} 0 75%, transparent 0) 0 0 / 40px 40px`,
  },
  {
    id: "columns",
    background: `repeating-linear-gradient(90deg, ${ink} 0 1px, transparent 1px 120px)`,
  },
];

/** Strength of --pattern-color, as a percentage of the text color. */
export const PATTERN_STRENGTH = 9;
