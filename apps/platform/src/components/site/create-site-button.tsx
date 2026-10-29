"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CREATE_HREF } from "./nav";

// Every button that leads to creating a site ("Criar meu site", "Criar site") has the same
// specular finish (E18): a cream highlight on the rim, centred on the cursor, over the solid
// green button, and a faint sheen inside (".specular" in globals.css).
//
// Smooth by construction: the light is its own composited layer, moved only with transform.
// pointermove only stores the target; one requestAnimationFrame per frame eases the light
// toward it (and stops once it arrives); the button's box is read on pointerenter, scroll and
// resize, never on a move. Nothing on the button itself repaints. Touch screens, reduced motion
// and no JavaScript get the light at rest on the top-left of the rim.

const EASE = 0.22;
/** The light at rest, as a fraction of the button's width and height. */
const REST = { x: 0.16, y: 0 };

export function CreateSiteButton({
  href = CREATE_HREF,
  children = "Criar meu site",
  size = "lg",
  arrow = true,
  className,
  onClick,
}: {
  href?: string;
  children?: React.ReactNode;
  /** "nav": the header's smaller button, with a quieter light. */
  size?: "lg" | "nav";
  arrow?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const link = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const element = link.current;
    if (!element) return;
    const lights = [...element.querySelectorAll<HTMLElement>("[data-specular-light]")];
    const mouse = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let box = { width: 0, height: 0, left: 0, top: 0 };
    let current = { ...REST };
    let target = { ...REST };
    let frame = 0;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      box = { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
    };
    const place = () => {
      // The light sits at the rest point in CSS (left 16%, top 0); this moves it from there.
      const x = (current.x - REST.x) * box.width;
      const y = (current.y - REST.y) * box.height;
      for (const light of lights) light.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const step = () => {
      current.x += (target.x - current.x) * EASE;
      current.y += (target.y - current.y) * EASE;
      const done = Math.abs(target.x - current.x) < 0.002 && Math.abs(target.y - current.y) < 0.002;
      if (done) current = { ...target };
      place();
      frame = done ? 0 : requestAnimationFrame(step);
    };
    const run = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };

    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !mouse.matches || reduce.matches) return;
      measure();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !mouse.matches || reduce.matches || !box.width) return;
      target = {
        x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
        y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
      };
      run();
    };
    const leave = () => {
      target = { ...REST };
      run();
    };
    // The cached box moves with the page.
    const stale = () => {
      box.width = 0;
    };

    measure();
    place();
    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", stale, { passive: true });
    window.addEventListener("resize", stale);
    const sized = new ResizeObserver(() => {
      measure();
      place();
    });
    sized.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      sized.disconnect();
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", stale);
      window.removeEventListener("resize", stale);
    };
  }, []);

  return (
    <Link
      ref={link}
      href={href}
      prefetch={false}
      onClick={onClick}
      data-create-site=""
      className={cn(
        buttonVariants({ size: "lg" }),
        "specular group",
        size === "nav" && "specular-nav h-11 px-4 text-sm lg:px-5 lg:text-[0.9375rem]",
        className,
      )}
    >
      {/* The rim and the sheen: each a still, clipped frame holding one moving light. */}
      <span aria-hidden="true" className="specular-rim">
        <span data-specular-light="" className="specular-light" />
      </span>
      <span aria-hidden="true" className="specular-sheen">
        <span data-specular-light="" className="specular-light specular-light-wide" />
      </span>
      {children}
      {arrow && (
        <ArrowRight
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      )}
    </Link>
  );
}
