"use client";

import { useEffect, useRef, useState } from "react";

// The example site inside the frame, created only when the frame is about to reach the screen.
// The browser's own loading="lazy" still fetched it during the first load (the frame sits
// right under the hero), competing with the fonts of the first screen. Without JavaScript the
// noscript copy loads it as usual. The page inside is a picture: inert and out of the tab order.

const frameProps = {
  title: "Site de exemplo da Padaria do Zé",
  tabIndex: -1,
  "aria-hidden": true,
  inert: true,
  className: "pointer-events-none absolute inset-0 block h-full w-full border-0 bg-white",
} as const;

export function ExampleFrame({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const area = ref.current;
    if (!area) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // Until then, no iframe at all: even an empty one costs the browser a whole document.
  return (
    <div ref={ref} className="relative">
      {near && <iframe src={src} {...frameProps} />}
      <noscript>
        <iframe src={src} {...frameProps} />
      </noscript>
    </div>
  );
}
