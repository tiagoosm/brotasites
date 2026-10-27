// Corner shapes: radius tokens for small elements, cards, large blocks, buttons and photos.

export interface Shape {
  id: string;
  radius: { sm: string; md: string; lg: string; button: string; image: string };
}

export const shapes: readonly Shape[] = [
  { id: "sharp", radius: { sm: "0", md: "0", lg: "0", button: "0", image: "0" } },
  { id: "soft", radius: { sm: "4px", md: "8px", lg: "12px", button: "8px", image: "8px" } },
  {
    id: "rounded",
    radius: { sm: "10px", md: "18px", lg: "28px", button: "999px", image: "22px" },
  },
  { id: "pill", radius: { sm: "14px", md: "24px", lg: "40px", button: "999px", image: "40px" } },
  {
    id: "arch",
    radius: {
      sm: "10px",
      md: "18px",
      lg: "28px",
      button: "999px",
      image: "999px 999px 18px 18px",
    },
  },
];

export function shapeVariables(shape: Shape): Record<string, string> {
  return {
    "--radius-sm": shape.radius.sm,
    "--radius-md": shape.radius.md,
    "--radius-lg": shape.radius.lg,
    "--radius-button": shape.radius.button,
    "--radius-image": shape.radius.image,
  };
}
