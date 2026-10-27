import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import { loadSiteConfig, siteUrl } from "./src/lib/config";
import {
  BODY_FONT_VAR,
  fallbacksFor,
  fontChoice,
  fontWeights,
  HEADING_FONT_VAR,
} from "./src/lib/fonts";

// The generator sets BROTASITES_CONFIG; `astro dev` / `astro build` here use the docs example.
process.env.BROTASITES_CONFIG ??= fileURLToPath(
  new URL("../../docs/legacy/site-config.example.v1.1.json", import.meta.url),
);

const { config, baseDir } = loadSiteConfig();
const fonts = fontChoice(config);
const weights = fontWeights(fonts);

type NonEmpty = [string, ...string[]];

// Google Fonts are downloaded at build time and self-hosted with the site.
const fontFamilies = [
  {
    provider: fontProviders.google(),
    name: fonts.body,
    cssVariable: BODY_FONT_VAR,
    weights: weights.body as NonEmpty,
    styles: ["normal"] as ["normal"],
    subsets: ["latin"] as NonEmpty,
    fallbacks: fallbacksFor(fonts.body),
  },
  ...(fonts.shared
    ? []
    : [
        {
          provider: fontProviders.google(),
          name: fonts.heading,
          cssVariable: HEADING_FONT_VAR,
          weights: weights.heading as NonEmpty,
          styles: ["normal"] as ["normal"],
          subsets: ["latin"] as NonEmpty,
          fallbacks: fallbacksFor(fonts.heading),
        },
      ]),
];

export default defineConfig({
  site: siteUrl(config),
  // Optional path the site is served under (e.g. /exemplo-site for the platform's example).
  base: process.env.BROTASITES_BASE || undefined,
  fonts: fontFamilies,
  devToolbar: { enabled: false },
  build: {
    // A single small stylesheet: inlining it removes a render-blocking request.
    inlineStylesheets: "always",
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // Image paths in the config are relative to the config file's folder.
      alias: { "@site": baseDir },
    },
  },
});
