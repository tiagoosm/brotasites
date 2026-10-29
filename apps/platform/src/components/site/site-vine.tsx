"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// A faint vine follows the mouse over the public pages, sprouting a few small leaves (E18: the
// whole page, not only the side margins). It shows only in the free space: over text, buttons,
// links, cards, fields, images, the questions' window, the header and the footer it fades out
// within a few px (vine-avoid.ts, lib/motion/vine.ts). Any width with a mouse; never on touch
// screens. Never in the way of clicks, hidden from assistive technology, off with reduced
// motion (see vine-trail.tsx), and loaded after the page, in the browser only.
const VineTrail = dynamic(() => import("./vine-trail"), { ssr: false });

const WITH_MOUSE = "(hover: hover) and (pointer: fine)";

export function SiteVine() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(WITH_MOUSE);
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
