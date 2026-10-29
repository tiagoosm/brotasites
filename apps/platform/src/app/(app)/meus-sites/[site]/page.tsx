"use client";

import { useParams } from "next/navigation";
import { SiteDashboard } from "./site-dashboard";

export default function SitePage() {
  const { site } = useParams<{ site: string }>();
  return <SiteDashboard siteId={site} />;
}
