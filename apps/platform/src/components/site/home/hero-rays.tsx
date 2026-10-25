"use client";

import dynamic from "next/dynamic";

// Morning light on the herbarium sheet: a faint pollen and leaf-green glow from the top right
// corner, behind the hero, with a few slow, soft beams. Loaded after the page, in the browser
// only, so it never delays the first paint; the page looks complete without it.
const SideRays = dynamic(() => import("../side-rays"), { ssr: false });
const VineTrail = dynamic(() => import("../vine-trail"), { ssr: false });

export function HeroRays() {
  return (
    // On phones the hero is narrow and tall, so the same light covers more text: tone it down.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 opacity-40 sm:opacity-60 lg:opacity-75"
    >
      <SideRays
        lightMode
        origin="top-right"
        rayColor1="#E2B23C"
        rayColor2="#9CC5A6"
        blend={0.45}
        speed={0.8}
        intensity={1.5}
        spread={2.2}
        density={3}
        sharpness={0.2}
        falloff={1.2}
        glow={0.5}
        mouseInfluence={0.15}
        opacity={0.8}
        maxDevicePixelRatio={1.25}
      />
    </div>
  );
}

/** A thin vine that follows the mouse over the hero, sprouting small leaves (desktop only). */
export function HeroVine() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <VineTrail />
    </div>
  );
}
