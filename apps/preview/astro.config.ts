import { fileURLToPath } from "node:url";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { port: 4400 },
  devToolbar: { enabled: false },
  security: {
    // The form posts the draft from another origin on purpose. Rendering has no side effects;
    // who may embed the preview is enforced with frame-ancestors (see src/pages/render.astro).
    checkOrigin: false,
  },
  build: { inlineStylesheets: "always" },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // Templates look up local images under "@site"; preview drafts have none yet.
      alias: { "@site": fileURLToPath(new URL("./src/no-images", import.meta.url)) },
    },
    ssr: { noExternal: ["@brotasites/templates"] },
  },
});
