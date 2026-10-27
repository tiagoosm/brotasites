import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import { loadAnyConfig, siteUrl, siteUrl12 } from "./src/lib/config";
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

const loaded = loadAnyConfig();
const { baseDir } = loaded;
const v12 = loaded.version === "1.2";

type NonEmpty = [string, ...string[]];

// 1.1 ("classico"): Google Fonts are downloaded at build time and self-hosted with the site.
// 1.2: fonts come from the catalog (src/pages/fonts), with no network access at all.
function googleFonts() {
  if (loaded.version !== "1.1") return [];
  const fonts = fontChoice(loaded.config);
  const weights = fontWeights(fonts);
  return [
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
}

const pageComponent = fileURLToPath(
  new URL(
    v12 ? "./src/v12/Page.astro" : "./src/templates/classico/ClassicoPage.astro",
    import.meta.url,
  ),
);

export default defineConfig({
  site: loaded.version === "1.2" ? siteUrl12(loaded.config) : siteUrl(loaded.config),
  // Optional path the site is served under (e.g. /exemplo-site for the platform's example).
  base: process.env.BROTASITES_BASE || undefined,
  fonts: googleFonts(),
  devToolbar: { enabled: false },
  integrations: [
    {
      // Motion Lab: an internal page, added only on request (src/lab/MotionLab.astro).
      name: "motion-lab",
      hooks: {
        "astro:config:setup": ({ injectRoute }) => {
          if (v12 && process.env.BROTASITES_LAB === "1") {
            injectRoute({ pattern: "/motion-lab", entrypoint: "./src/lab/MotionLab.astro" });
          }
        },
      },
    },
  ],
  build: {
    // 1.1: a single small stylesheet, inlined to save a request. 1.2: the sites' CSP allows no
    // inline styles, so stylesheets stay files.
    inlineStylesheets: v12 ? "never" : "always",
  },
  vite: {
    plugins: v12 ? [] : [tailwindcss()],
    build: {
      // 1.2: no inline scripts or data: URIs (CSP: scripts and images from the site only).
      assetsInlineLimit: v12 ? 0 : undefined,
    },
    resolve: {
      // Image paths in the config are relative to the config file's folder.
      // "@site-page": the page of the config's version, so a site only ships its own CSS.
      alias: { "@site": baseDir, "@site-page": pageComponent },
    },
  },
});
