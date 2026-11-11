"use client";

import dynamic from "next/dynamic";

// The hero title's letter lift (title-lift.tsx), loaded after the page, in the browser only, so
// it never weighs on the first paint.
const TitleLift = dynamic(() => import("./title-lift"), { ssr: false });

export function HeroTitleLift({ target }: { target: string }) {
  return <TitleLift target={target} />;
}
