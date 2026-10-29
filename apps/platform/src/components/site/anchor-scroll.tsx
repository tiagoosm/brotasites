"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { easeInOut, scrollDuration, scrollTarget, sectionOf } from "@/lib/motion/scroll";
import { visiblePath } from "./nav";

// The links to the home page's sections (Como funciona, Preço, Dúvidas: header, phone menu,
// footer, hero) scroll there smoothly (E18), in about 0.6 to 0.9 s with an ease-in-out curve,
// stopping under the sticky header (the section's scroll-margin-top), then move the focus to
// the section's title and put the "#" in the address. From another page, the home page opens
// and then scrolls. Any wheel, touch or key stops it at once; reduced motion jumps straight
// there. Only these links: normal scrolling, the back button and other anchors are untouched.
// While it runs, html[data-jumping] tells the section entrances to show what they pass at once.

const PENDING = "brotasites:scroll-to";

function scrollToSection(id: string) {
  const section = document.getElementById(id);
  if (!section) return;
  const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const from = window.scrollY;
  const to = scrollTarget(section.getBoundingClientRect().top, from, margin, max);
  const title = section.querySelector<HTMLElement>("h2") ?? section;
  const finish = () => {
    if (!title.hasAttribute("tabindex")) title.setAttribute("tabindex", "-1");
    title.focus({ preventScroll: true });
    if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || from === to) {
    window.scrollTo(0, to);
    finish();
    return;
  }

  const root = document.documentElement;
  const duration = scrollDuration(to - from);
  let start = 0;
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) {
      window.removeEventListener(type, stop);
    }
    window.setTimeout(() => root.removeAttribute("data-jumping"), 150);
  };
  const step = (now: number) => {
    if (!start) start = now;
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo(0, from + (to - from) * easeInOut(t));
    if (t < 1) {
      frame = requestAnimationFrame(step);
    } else {
      stop();
      finish();
    }
  };
  root.setAttribute("data-jumping", "");
  for (const type of ["wheel", "touchstart", "keydown", "pointerdown"]) {
    window.addEventListener(type, stop, { passive: true, once: true });
  }
  frame = requestAnimationFrame(step);
}

/** After the current click: a closing phone menu first gives the page its scroll back. */
const soon = (run: () => void) => requestAnimationFrame(() => requestAnimationFrame(run));

export function AnchorScroll() {
  const pathname = visiblePath(usePathname());
  const router = useRouter();

  // Arriving on the home page from a section link elsewhere.
  useEffect(() => {
    if (pathname !== "/") return;
    let id: string | null = null;
    try {
      id = window.sessionStorage.getItem(PENDING);
      window.sessionStorage.removeItem(PENDING);
    } catch {
      // Storage blocked: the page simply opens at the top.
    }
    if (id) soon(() => scrollToSection(id));
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a");
      const id = sectionOf(link?.getAttribute("href") ?? null);
      if (!link || !id || link.target === "_blank") return;
      event.preventDefault();
      if (pathname === "/") {
        soon(() => scrollToSection(id));
        return;
      }
      try {
        window.sessionStorage.setItem(PENDING, id);
      } catch {
        window.location.assign(`/#${id}`);
        return;
      }
      router.push("/");
    };
    // Capture: before the link's own navigation (Next.js Link skips a prevented click).
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, router]);

  return null;
}
