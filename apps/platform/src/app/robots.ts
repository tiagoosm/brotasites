import type { MetadataRoute } from "next";
import { PLATFORM_URL } from "@/lib/site-url";

// The form, sign-in and account pages are personal: only the public pages are indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/criar", "/entrar", "/meu-site", "/meus-sites", "/auth", "/api"],
    },
    sitemap: `${PLATFORM_URL}/sitemap.xml`,
  };
}
