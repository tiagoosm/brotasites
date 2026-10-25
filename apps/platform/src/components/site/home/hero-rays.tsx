"use client";

import dynamic from "next/dynamic";

// Morning light falling on the herbarium sheet: pollen and leaf-green rays from the top
// right corner, behind the hero. Loaded after the page, in the browser only, so it never
// delays the first paint; the page looks complete without it.
const SideRays = dynamic(() => import("../side-rays"), { ssr: false });

export function HeroRays() {
  return (
    // On phones the hero is narrow and tall, so the same light covers the text: tone it down.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 opacity-45 sm:opacity-75 lg:opacity-100"
    >
      <SideRays
        lightMode
        origin="top-right"
        rayColor1="#E2B23C"
        rayColor2="#7FB58F"
        blend={0.4}
        speed={1.4}
        intensity={3}
        spread={2.6}
        density={5}
        sharpness={0.45}
        falloff={0.9}
        glow={0.8}
        dust={0.25}
        mouseInfluence={0.35}
        opacity={1}
        maxDevicePixelRatio={1.5}
      />
    </div>
  );
}
