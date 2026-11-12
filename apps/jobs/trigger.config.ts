import { additionalFiles, additionalPackages } from "@trigger.dev/build/extensions/core";
import { playwright } from "@trigger.dev/build/extensions/playwright";
import { defineConfig } from "@trigger.dev/sdk";

// Trigger.dev project (decision of E10, docs/owner-steps.md). The project ref comes from the
// owner's account (TRIGGER_PROJECT_REF).
//
// The image (E35d). The tasks are bundled, but building a site runs `astro build` in a child
// process over the templates' Astro project, which the bundler never sees:
// - playwright: installs Chromium for the reviewer and the direction screenshots.
// - additionalPackages: npm-installs Astro, its Tailwind plugin, sharp and zod in the image
//   (/app/node_modules), at the versions of pnpm-lock.yaml. It also tells the bundler that
//   `astro` is there, which silences the createRequire warning of packages/generator.
// - additionalFiles: copies, as plain files, the templates' Astro project, the catalog and
//   schema it imports (with the catalog's fonts) and the AI playbooks. They land under
//   /app/node_modules/@brotasites/..., because the globs go through apps/jobs/node_modules.
// The lists are exported for test/image.test.ts and the local image smoke test.

/**
 * Installed with npm in the image. Pinned to pnpm-lock.yaml (a test compares them): the
 * templates' Astro build needs them at run time, from /app/node_modules.
 */
export const IMAGE_PACKAGES = [
  "astro@7.4.0",
  "@tailwindcss/vite@4.3.3",
  "tailwindcss@4.3.3",
  "sharp@0.35.5",
  "zod@4.6.7",
] as const;

/**
 * Copied as files, relative to apps/jobs. Going through node_modules (pnpm's links to the
 * workspace packages) puts them at /app/node_modules/@brotasites/<package>/, where the
 * templates find the catalog and the schema by name.
 */
export const IMAGE_FILES = [
  // The templates' Astro project, run by `astro build --root` (packages/generator).
  "node_modules/@brotasites/templates/package.json",
  "node_modules/@brotasites/templates/index.js",
  "node_modules/@brotasites/templates/astro.config.ts",
  "node_modules/@brotasites/templates/tsconfig.json",
  "node_modules/@brotasites/templates/src/**",
  // What the templates import: the catalog (with its fonts) and the schema, already built.
  "node_modules/@brotasites/catalog/package.json",
  "node_modules/@brotasites/catalog/dist/**",
  "node_modules/@brotasites/catalog/fonts/**",
  "node_modules/@brotasites/schema/package.json",
  "node_modules/@brotasites/schema/dist/**",
  // The copy playbooks the AI reads from disk (packages/ai/src/playbooks.ts).
  "node_modules/@brotasites/ai/package.json",
  "node_modules/@brotasites/ai/playbooks/**",
] as const;

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_to_be_created",
  dirs: ["./src/trigger"],
  maxDuration: 1800,
  build: {
    extensions: [
      playwright({ browsers: ["chromium"] }),
      additionalPackages({ packages: [...IMAGE_PACKAGES] }),
      additionalFiles({ files: [...IMAGE_FILES] }),
    ],
  },
});
