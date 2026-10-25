"use client";

import dynamic from "next/dynamic";

// A faint vine follows the mouse across every public page, sprouting a few small leaves.
// Fixed over the viewport and never in the way of clicks; desktop only and off with reduced
// motion (see vine-trail.tsx). Loaded after the page, in the browser only.
const VineTrail = dynamic(() => import("./vine-trail"), { ssr: false });

export function SiteVine() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-20">
      <VineTrail
        stems={["#2F5D45"]}
        thickness={2.5}
        opacity={0.4}
        leafEvery={110}
        leafSize={0.34}
        leafLife={1.3}
        wave={0.25}
      />
    </div>
  );
}
