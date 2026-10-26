"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// A faint vine follows the mouse in the side margins of the public pages, sprouting a few
// small leaves. It never crosses the content column (text and cards): a mask hides it
// there, and screens without real margins (under 1280px) or without a mouse do not get it
// at all. Never in the way of clicks, hidden from assistive technology, off with reduced
// motion (see vine-trail.tsx), and loaded after the page, in the browser only.
const VineTrail = dynamic(() => import("./vine-trail"), { ssr: false });

const WIDE_WITH_MOUSE = "(min-width: 1280px) and (hover: hover) and (pointer: fine)";

// The content column is max-w-6xl (72rem); the vine shows only outside it, fading in over
// a short distance so its edge is soft.
const MARGINS_ONLY =
  "linear-gradient(to right, #000 calc(50% - 38rem), transparent calc(50% - 36rem), transparent calc(50% + 36rem), #000 calc(50% + 38rem))";

export function SiteVine() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(WIDE_WITH_MOUSE);
    const update = () => setEnabled(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (!enabled) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="site-vine"
      className="pointer-events-none fixed inset-0 z-20"
      style={{ maskImage: MARGINS_ONLY, WebkitMaskImage: MARGINS_ONLY }}
    >
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
