import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The picomatch ReDoS (GHSA-fc5q-39xc-vjpf, CVE-2026-112366) has no fixed release, so it is
// fixed by a local patch (patches/picomatch@*.patch) and accepted in `pnpm audit`
// (pnpm-workspace.yaml, auditConfig.ignoreGhsas) ONLY while that patch protects every copy.
// This test is the lock on that exception: it fails if a picomatch version without the patch
// reaches the lockfile, or if the attack pattern still hangs a patched copy.

const root = join(import.meta.dirname, "../..");
const GHSA = "GHSA-fc5q-39xc-vjpf";
const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
const lockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

const patchedVersions = [...workspace.matchAll(/^\s+picomatch@([\d.]+): patches\//gm)].map(
  (match) => match[1],
);

describe("the picomatch ReDoS stays fixed while its advisory is accepted", () => {
  it("accepts the advisory only together with a patch for every picomatch in the lockfile", () => {
    const accepted = workspace.includes(GHSA);
    const versions = new Set(
      // The resolved installs: `  picomatch@4.0.7(patch_hash=…): {}`, or `picomatch@4.0.7: {}`
      // when unpatched (the metadata entries above them carry no patch either way).
      [...lockfile.matchAll(/^ {2}picomatch@([\d.]+)(\(patch_hash=[a-f0-9]+\))?: \{\}/gm)].map(
        (match) => `${match[1]}${match[2] ? "+patch" : ""}`,
      ),
    );
    expect(versions.size).toBeGreaterThan(0);
    if (!accepted) return;
    for (const version of versions) {
      expect(version, `picomatch ${version} has no patch but ${GHSA} is ignored`).toMatch(
        /\+patch$/,
      );
    }
    for (const version of patchedVersions) {
      const patch = readFileSync(join(root, `patches/picomatch@${version}.patch`), "utf8");
      expect(patch).toContain(GHSA);
    }
  });

  it("a crafted pattern no longer hangs any installed patched copy", () => {
    const store = join(root, "node_modules/.pnpm");
    const copies = existsSync(store)
      ? readdirSync(store).filter((name) => /^picomatch@[\d.]+_patch_hash=/.test(name))
      : [];
    expect(copies.length).toBe(patchedVersions.length);
    for (const copy of copies) {
      const dir = join(store, copy, "node_modules/picomatch");
      // A child process with a time limit: an unpatched copy would block for minutes.
      const run = spawnSync(
        process.execPath,
        [
          "-e",
          `const pm = require(${JSON.stringify(dir)});
           for (const p of ["+(*a)", "*(*a)", "+(*)"]) pm.makeRe(p).test("a".repeat(40) + "!");
           // Safe patterns keep working.
           if (!pm.isMatch("abc.js", "*.js") || !pm.isMatch("a/b/c.ts", "**/*.ts")) process.exit(2);`,
        ],
        { timeout: 5000 },
      );
      expect(run.signal, `${copy} still backtracks`).toBeNull();
      expect(run.status, `${copy} broke ordinary globs`).toBe(0);
    }
  });
});
