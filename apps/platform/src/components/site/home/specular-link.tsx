"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The hero's main button with a specular finish: a highlight runs along its rim toward the
// cursor (".specular" in globals.css). It stays a solid green link: the light is only on the
// rim and a faint sheen, so the text keeps its contrast. Touch screens, reduced motion and
// no JavaScript get a still highlight on the top-left of the rim. The pointer only moves two
// CSS variables, without re-rendering anything.

export function SpecularLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  const follow = (event: React.PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const target = event.currentTarget;
    const box = target.getBoundingClientRect();
    target.style.setProperty("--spec-x", `${((event.clientX - box.left) / box.width) * 100}%`);
    target.style.setProperty("--spec-y", `${((event.clientY - box.top) / box.height) * 100}%`);
  };
  const rest = (event: React.PointerEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.removeProperty("--spec-x");
    event.currentTarget.style.removeProperty("--spec-y");
  };

  return (
    <Link
      {...props}
      onPointerMove={follow}
      onPointerLeave={rest}
      className={cn(buttonVariants({ size: "lg" }), "specular group", className)}
    >
      {children}
    </Link>
  );
}
