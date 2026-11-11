"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

// The click sparks (click-sparks.tsx), loaded after the page, in the browser only, on the
// public pages and the signed-in area. Never loaded in the team's area; on the admin host the
// component itself stays off.
const ClickSparks = dynamic(() => import("./click-sparks"), { ssr: false });

export function SiteSparks() {
  const path = usePathname() ?? "";
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  return <ClickSparks />;
}
