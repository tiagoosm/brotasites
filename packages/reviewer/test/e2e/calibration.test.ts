import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildStaticSite } from "@brotasites/generator";
import { templatesRoot } from "@brotasites/templates";
import { describe, expect, it } from "vitest";
import { runCalibration } from "../../src/calibration.js";
import { reviewSite, SimulatedReviewerAgent } from "../../src/index.js";
import { fixture } from "../helpers.js";

// The 20 known defects and 5 clean sites (docs/ai-and-reviewer.md, Reviewer 4). The numbers are
// printed so CI shows them; a missed defect or a false alarm fails the run.

describe("reviewer calibration", () => {
  it("catches every known defect and raises no false alarm", async () => {
    const report = await runCalibration();
    console.log(
      `Reviewer calibration: ${report.hits}/${report.defects} defects caught, ${report.falseAlarms} false alarms on ${report.cleanSites} clean sites and the defective ones.`,
    );
    for (const result of report.results) {
      if (!result.hit || result.falseAlarms.length > 0) {
        console.log(
          result.id,
          result.hit ? "" : "MISSED",
          result.falseAlarms.map((f) => `${f.check}@${f.where}: ${f.message}`),
        );
      }
    }
    expect(report.defects).toBe(20);
    expect(report.hits).toBe(20);
    expect(report.falseAlarms).toBe(0);
  });

  it("reviews a real build end to end and passes the clean fixture", async () => {
    const work = mkdtempSync(join(tmpdir(), "brotasites-review-e2e-"));
    const fixtureDir = join(templatesRoot, "e2e/fixture-v12");
    cpSync(join(fixtureDir, "assets"), join(work, "assets"), { recursive: true });
    let builds = 0;
    const report = await reviewSite({
      config: fixture(),
      form: fixture(),
      agent: new SimulatedReviewerAgent(),
      build: async (config) => {
        const configPath = join(work, "site-config.json");
        writeFileSync(configPath, JSON.stringify(config));
        const distDir = join(work, `dist-${builds++}`);
        const result = await buildStaticSite(configPath, distDir);
        if (!result.ok) throw new Error(result.log);
        expect(readFileSync(join(distDir, "index.html"), "utf8")).toContain("Padaria do Zé");
        return { distDir };
      },
    });
    expect(report.findings).toEqual([]);
    expect(report.status).toBe("passed");
  });
});
