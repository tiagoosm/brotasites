"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

// Morning light on the herbarium sheet: a pollen and leaf-green glow from the top right corner,
// with wide, slow beams. It lights the sign-in and sign-up pages, behind their card (E25, E26).
//
// Layers, all from the colour tokens (--morning-pollen, --morning-leaf in globals.css):
// - a static CSS light (".morning-glow": a halo behind the card and the corner's glow;
//   ".morning-beams": a few broad, blurred shafts), always there: it is what a visitor sees
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
    // Its own clipped layer, which starts behind the header (it shows faintly through the
    // header's frosted glass) and dissolves at every edge: no hard line under the header. The
    // page itself never hides overflow (E26), so the card can grow.
    <div
      aria-hidden="true"
      data-morning-light=""
      className="pointer-events-none absolute inset-x-0 -top-16 bottom-0 -z-10 overflow-hidden"
    >
      <div className="morning-glow absolute inset-0" />
      <div className="morning-beams absolute inset-0" />
      {!reduced && (
        // A few broad, blurred shafts (E27): soft edges, little repetition, calmer than before.
        <div className="morning-rays absolute inset-0 opacity-55 sm:opacity-65 lg:opacity-75">
          <SideRays
            lightMode
            origin="top-right"
            rayColor1={token("--morning-ray", "#EBC566")}
            rayColor2={token("--morning-ray-leaf", "#A9D1A8")}
            blend={0.35}
            speed={0.6}
            intensity={2.6}
            spread={4.6}
            density={1.6}
            sharpness={0.02}
            falloff={0.55}
            glow={0.4}
            saturation={1}
            mouseInfluence={0.12}
            opacity={1}
            maxDevicePixelRatio={1}
          />
        </div>
      )}
    </div>
  );
}
