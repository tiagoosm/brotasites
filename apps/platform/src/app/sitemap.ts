import type { MetadataRoute } from "next";
import { PLATFORM_URL, publicPages } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map((path) => ({
    url: `${PLATFORM_URL}${path === "/" ? "" : path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
