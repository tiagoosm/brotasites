import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Where the Astro project lives on disk. Normally this file's own folder. In the Trigger.dev
// image the jobs are bundled, so this file's URL points into the bundle (/app/...) instead;
// there the project ships as plain files under /app/node_modules/@brotasites/templates
// (apps/jobs/trigger.config.ts, E35d) and is found by package resolution: from the bundle's
// own location, then from the working directory. BROTASITES_TEMPLATES_ROOT overrides all.
function findTemplatesRoot() {
  const fromEnv = process.env.BROTASITES_TEMPLATES_ROOT;
  if (fromEnv) return fromEnv.endsWith("/") ? fromEnv : `${fromEnv}/`;
  const here = fileURLToPath(new URL(".", import.meta.url));
  if (existsSync(join(here, "astro.config.ts"))) return here;
  for (const from of [import.meta.url, join(process.cwd(), "index.js")]) {
    try {
      const pkg = createRequire(from).resolve("@brotasites/templates/package.json");
      if (existsSync(join(dirname(pkg), "astro.config.ts"))) return `${dirname(pkg)}/`;
    } catch {
      // Not resolvable from there: try the next place.
    }
  }
  return here;
}

/** Absolute path of the Astro project that renders the templates. */
export const templatesRoot = findTemplatesRoot();

/** Templates that are implemented and can be generated. */
export const availableTemplates = ["classico"];
