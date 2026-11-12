// Local stand-in for the Trigger.dev image (E35d): builds a folder laid out like the image's
// /app, with only what the image will have, and generates a site from it. No account, no deploy.
//
//   pnpm --filter @brotasites/jobs image:smoke      (needs the npm registry; about a minute)
//
// 1. npm-installs IMAGE_PACKAGES into <tmp>/node_modules, as the image's `npm i` does.
// 2. Copies IMAGE_FILES with Trigger.dev's own copy helper (@trigger.dev/build/internal), so the
//    files land where additionalFiles puts them.
// 3. From <tmp> as the working directory, outside the repository (so nothing resolves from it):
//    - a copy of the templates' index.js placed like a bundle finds the project by itself;
//    - the playbooks load the same way;
//    - `astro build` runs over the copied project and writes a site.
// The generator itself runs from the repository: in the image it is part of the bundle.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { copyMatcherResults, findFilesByMatchers } from "@trigger.dev/build/internal";
import { IMAGE_FILES, IMAGE_PACKAGES } from "../trigger.config.ts";

const jobsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(jobsRoot, "../..");
const app = mkdtempSync(join(tmpdir(), "brotasites-image-"));
const keep = process.argv.includes("--keep");

function step(text: string) {
  console.log(`\n· ${text}`);
}

try {
  step(`npm i ${IMAGE_PACKAGES.join(" ")} in ${app}`);
  const dependencies = Object.fromEntries(
    IMAGE_PACKAGES.map((spec) => {
      const at = spec.lastIndexOf("@");
      return [spec.slice(0, at), spec.slice(at + 1)];
    }),
  );
  writeFileSync(join(app, "package.json"), JSON.stringify({ name: "image", dependencies }));
  execFileSync("npm", ["i", "--no-audit", "--no-fund", "--no-save", "--no-package-lock"], {
    cwd: app,
    stdio: "inherit",
  });

  step("additionalFiles");
  const found = await findFilesByMatchers([...IMAGE_FILES], app, { cwd: jobsRoot });
  for (const { matcher, assets } of found) {
    if (assets.length === 0) throw new Error(`No files for ${matcher}`);
  }
  const copied = await copyMatcherResults(found);
  console.log(`  ${copied} files under ${join(app, "node_modules/@brotasites")}`);

  // Run the rest from the fake /app, in a child process, as the image's worker does.
  const probe = join(app, "bundle");
  mkdirSync(probe);
  copyFileSync(
    join(app, "node_modules/@brotasites/templates/index.js"),
    join(probe, "templates.mjs"),
  );
  copyFileSync(join(repo, "packages/ai/dist/playbooks.js"), join(probe, "playbooks.mjs"));
  const script = `
    const { templatesRoot } = await import(${JSON.stringify(pathToFileURL(join(probe, "templates.mjs")).href)});
    const expected = ${JSON.stringify(join(app, "node_modules/@brotasites/templates/"))};
    if (templatesRoot !== expected) throw new Error("templatesRoot " + templatesRoot + " != " + expected);
    console.log("  templatesRoot from the working directory: ok");
    const { playbookFor } = await import(${JSON.stringify(pathToFileURL(join(probe, "playbooks.mjs")).href)});
    const food = playbookFor("food");
    if (!food.text) throw new Error("empty playbook");
    console.log("  playbooks from the working directory: ok (" + food.version + ")");
    process.env.BROTASITES_TEMPLATES_ROOT = templatesRoot;
    const { buildStaticSite } = await import(${JSON.stringify(pathToFileURL(join(repo, "packages/generator/dist/index.js")).href)});
    // The call the job makes (apps/jobs/src/pipeline.ts), with the v1.2 example (Padaria do Zé).
    const result = await buildStaticSite(
      ${JSON.stringify(join(repo, "docs/site-config.example.json"))},
      ${JSON.stringify(join(app, "site"))},
    );
    if (!result.ok) {
      console.error(result.log);
      process.exit(1);
    }
    console.log("  astro build over the image's files: ok");
  `;
  step("from the image's working directory");
  execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: app,
    stdio: "inherit",
    // No global NODE_PATH: only what the fake image has may resolve.
    env: { ...process.env, NODE_PATH: "", ASTRO_TELEMETRY_DISABLED: "1" },
  });
  const index = join(app, "site/index.html");
  if (!existsSync(index)) throw new Error("No index.html");
  console.log(`\nImage smoke test passed: ${index}`);
} finally {
  if (!keep) rmSync(app, { recursive: true, force: true });
}
