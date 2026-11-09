"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAVIGATION_EVENT } from "@/lib/navigation";

// The thin bar at the top during any internal navigation (E26, Doherty: every click shows a
// change within 100ms). It starts on the click itself (an internal link, a form sent to the
// platform, or a navigation the code announces) and finishes when the address changes. No
// dependency: the click is read in the capture phase, before Next.js handles it. With reduced
// motion it is a still bar, not a moving one. A safety stop ends it after 10 seconds.

type State = "idle" | "loading" | "done";

function internalTarget(event: MouseEvent): URL | null {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }
  const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!link || link.hasAttribute("download")) return null;
  if (link.target && link.target !== "_self") return null;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // The same page (an anchor, a hash): nothing loads.
  if (url.pathname === window.location.pathname) return null;
  return url;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<State>("idle");
  const started = useRef<string | null>(null);

  // The address changed: the next page is on screen.
  useEffect(() => {
    if (started.current !== null && started.current !== pathname) {
      started.current = null;
      setState("done");
    }
  }, [pathname]);

  useEffect(() => {
    const start = () => {
      started.current = window.location.pathname;
      setState("loading");
    };
    const onClick = (event: MouseEvent) => {
      if (internalTarget(event)) start();
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      // Only real page loads (sign out); forms handled in the page call preventDefault.
      if (event.defaultPrevented || !form?.getAttribute("action")) return;
      if (form.method.toLowerCase() !== "post") return;
      const url = new URL(form.action, window.location.href);
      if (url.origin === window.location.origin) start();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    window.addEventListener(NAVIGATION_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener(NAVIGATION_EVENT, start);
    };
  }, []);

  useEffect(() => {
    if (state === "loading") {
      const safety = window.setTimeout(() => setState("done"), 10_000);
      return () => window.clearTimeout(safety);
    }
    if (state === "done") {
      const hide = window.setTimeout(() => setState("idle"), 400);
      return () => window.clearTimeout(hide);
    }
  }, [state]);

  return (
    <div
      aria-hidden="true"
      data-navigation-progress={state}
      className="navigation-progress pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]"
    />
  );
}
