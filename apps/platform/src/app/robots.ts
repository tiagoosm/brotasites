import type { MetadataRoute } from "next";
import { PLATFORM_URL } from "@/lib/site-url";

// The form, sign-in and account pages are personal: only the public pages are indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/criar",
        "/entrar",
        "/cadastro",
        "/esqueci-senha",
        "/redefinir-senha",
        "/conta",
        "/meu-site",
        "/meus-sites",
        "/admin",
        "/auth",
        "/api",
      ],
    },
    sitemap: `${PLATFORM_URL}/sitemap.xml`,
  };
}
