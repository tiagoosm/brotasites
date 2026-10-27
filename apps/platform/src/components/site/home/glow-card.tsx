"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// The price card's border glow (".glow-card" in globals.css): a gradient of the brand greens,
// with a short touch of the example's amber, lit on the side of the card nearest the cursor
// and brighter as the cursor nears the edge. Touch screens, reduced motion and no JavaScript
// get a soft, still glow. The content never depends on it, and the pointer only moves two
// CSS variables, without re-rendering anything.

export function GlowCard({ className, children, ...props }: ComponentProps<"div">) {
  const follow = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const card = event.currentTarget;
    const box = card.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    // 0deg points up, as in a conic gradient.
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    // 0 at the center, 1 on the edge.
    const edge = Math.min(
      1,
      Math.max(Math.abs(dx) / (box.width / 2), Math.abs(dy) / (box.height / 2)),
    );
    card.style.setProperty("--glow-angle", `${angle}deg`);
    card.style.setProperty("--glow-strength", String(0.45 + 0.55 * edge ** 2));
  };
  const rest = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.removeProperty("--glow-angle");
    event.currentTarget.style.removeProperty("--glow-strength");
  };

  return (
    <div
      {...props}
      onPointerMove={follow}
      onPointerLeave={rest}
      className={cn("glow-card", className)}
    >
      {children}
    </div>
  );
}
