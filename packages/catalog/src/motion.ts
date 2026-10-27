// Motion presets: the numbers behind the data-anim attributes (docs/default-motion.md). This
// round has a single preset; durations stay within the documented limits.

export interface MotionPreset {
  id: string;
  variables: Record<string, string>;
}

export const motionPresets: readonly MotionPreset[] = [
  {
    id: "default",
    variables: {
      "--anim-micro": "200ms",
      "--anim-enter": "600ms",
      "--anim-shift": "20px",
      "--anim-stagger": "75ms",
      "--anim-blur": "6px",
      "--anim-ease": "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  },
];
