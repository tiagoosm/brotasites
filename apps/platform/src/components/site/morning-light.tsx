"use client";

import dynamic from "next/dynamic";

// Morning light on the herbarium sheet: a soft pollen and leaf-green glow from the top right
// corner, with wide, slow beams. Since 2026-11-05 it lights the sign-in and sign-up pages, behind their card, not the home
// page (owner's decision). Loaded after the page, in the browser only, so it never delays the
// first paint; the page looks complete without it.
const SideRays = dynamic(() => import("./side-rays"), { ssr: false });

export function MorningLight() {
  return (
    // On phones the column is narrow and tall, so the same light covers more text: tone it down.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 opacity-40 sm:opacity-65 lg:opacity-85"
    >
      <SideRays
        lightMode
        origin="top-right"
        rayColor1="#E2B23C"
        rayColor2="#9CC5A6"
        blend={0.45}
        speed={0.8}
        intensity={2.1}
        spread={3.4}
        density={3}
        sharpness={0.2}
        falloff={0.75}
        glow={0.6}
        mouseInfluence={0.15}
        opacity={0.8}
        maxDevicePixelRatio={1.25}
      />
    </div>
  );
}
