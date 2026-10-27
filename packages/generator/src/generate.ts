import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { templatesRoot } from "@brotasites/templates";
import { checkImages } from "./images.js";
import { IMAGES_DIR, localizeRemoteImages, type RemoteImageOptions } from "./remote-images.js";
import { readSiteConfig } from "./validate.js";

const RESOLVED_CONFIG = ".brotasites-config.json";

export interface GenerateOptions extends RemoteImageOptions {
  /** Path to the site config JSON. Image paths inside it are relative to its folder. */
  configPath: string;
  /** Folder where the static site is written. */
  outDir: string;
  /** Path the site is served under, when not the root (e.g. "/exemplo-site"). */
  base?: string;
}

export type GenerateResult =
  | { success: true; outDir: string; warnings: string[] }
  | { success: false; errors: string[]; warnings: string[] };

function astroBin(): string {
  const require = createRequire(join(templatesRoot, "package.json"));
  const pkgPath = require.resolve("astro/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { bin: { astro: string } };
  return join(dirname(pkgPath), pkg.bin.astro);
}

/** Runs `astro build` in a child process so each build gets its own config and environment. */
function runAstroBuild(
  configPath: string,
  outDir: string,
  base?: string,
): Promise<{ ok: boolean; log: string }> {
  return new Promise((resolvePromise) => {
    // The working directory is the output's parent, not the templates package: with an outDir
    // outside its working directory Astro writes its build scratch to `<cwd>/.astro`, which two
    // builds at the same time would share and break.
    const args = [astroBin(), "build", "--root", templatesRoot, "--outDir", outDir];
    const child = spawn(process.execPath, args, {
      cwd: dirname(outDir),
      env: {
        ...process.env,
        BROTASITES_CONFIG: configPath,
        BROTASITES_BASE: base ?? "",
        ASTRO_TELEMETRY_DISABLED: "1",
      },
    });
    let log = "";
    child.stdout.on("data", (chunk) => {
      log += chunk;
    });
    child.stderr.on("data", (chunk) => {
      log += chunk;
    });
    child.on("error", (error) => resolvePromise({ ok: false, log: `${log}\n${error.message}` }));
    child.on("close", (code) => resolvePromise({ ok: code === 0, log }));
  });
}

/** Validates the config and builds the static site. */
export async function generateSite(options: GenerateOptions): Promise<GenerateResult> {
  const configPath = resolve(options.configPath);
  const outDir = resolve(options.outDir);

  const validation = await readSiteConfig(configPath);
  if (!validation.success) return { success: false, errors: validation.errors, warnings: [] };

  const baseDir = dirname(configPath);
  const remote = await localizeRemoteImages(validation.config, baseDir, options);
  const warnings = [...remote.warnings, ...(await checkImages(remote.config, baseDir))];

  // With downloaded photos, the build reads a copy of the config that points to them.
  const resolvedPath = join(baseDir, RESOLVED_CONFIG);
  await mkdir(dirname(outDir), { recursive: true });
  const usesCopy = remote.downloaded > 0 || remote.warnings.length > 0;
  if (usesCopy) await writeFile(resolvedPath, JSON.stringify(remote.config, null, 2));
  try {
    const build = await runAstroBuild(usesCopy ? resolvedPath : configPath, outDir, options.base);
    if (!build.ok) {
      return {
        success: false,
        errors: ["Falha ao gerar o site. Detalhes técnicos abaixo.", build.log.trim()],
        warnings,
      };
    }
    return { success: true, outDir, warnings };
  } finally {
    if (usesCopy) {
      await rm(resolvedPath, { force: true });
      await rm(join(baseDir, IMAGES_DIR), { recursive: true, force: true });
    }
  }
}
