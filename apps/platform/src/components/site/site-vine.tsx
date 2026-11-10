"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// A faint, short vine follows the mouse over the public pages (E18; since E31 no leaves, at most
// about 140 px of tail, gone 0.4 s after the mouse stops). It shows only in the free space: over text, buttons,
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
      <VineTrail color="#2F5D45" thickness={2} opacity={0.28} length={140} wave={0.15} />
    </div>
  );
}
