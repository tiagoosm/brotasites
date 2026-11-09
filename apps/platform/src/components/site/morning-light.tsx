"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

// Morning light on the herbarium sheet: a pollen and leaf-green glow from the top right corner,
// with wide, slow beams. It lights the sign-in and sign-up pages, behind their card (E25, E26).
//
// Two layers, both from the colour tokens (--morning-pollen, --morning-leaf in globals.css):
// - a static CSS glow with soft beams (".morning-glow"), always there: it is what a visitor sees
//   without WebGL, with reduced motion and before the script loads, with the same presence;
// - the moving beams (side-rays.tsx, WebGL), loaded after the page in the browser only, so they
//   never delay the first paint. Once they draw, the static glow steps back.
const SideRays = dynamic(() => import("./side-rays"), { ssr: false });

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribe = (change: () => void) => {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};

/** A colour token of the page, read once on the client (the rays take plain hex). */
function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function MorningLight() {
  // Reduced motion: the static glow only, nothing moves.
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(reducedQuery).matches,
    () => true,
  );
  return (
    // Its own clipped layer: the page itself never hides overflow (E26), so the card can grow.
    // On phones the column is narrow and tall, so the same light covers more: a little softer.
    <div
      aria-hidden="true"
      data-morning-light=""
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="morning-glow absolute inset-0" />
      {!reduced && (
        <div className="morning-rays absolute inset-0 opacity-60 sm:opacity-85 lg:opacity-100">
          <SideRays
            lightMode
            origin="top-right"
            rayColor1={token("--morning-pollen", "#E2B23C")}
            rayColor2={token("--morning-leaf", "#7FB98C")}
            blend={0.42}
            speed={0.8}
            intensity={2.8}
            spread={3.9}
            density={3}
            sharpness={0.22}
            falloff={0.68}
            glow={0.75}
            saturation={1.25}
            mouseInfluence={0.15}
            opacity={0.9}
            maxDevicePixelRatio={1.25}
          />
        </div>
      )}
    </div>
  );
}
