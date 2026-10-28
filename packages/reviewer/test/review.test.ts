import { describe, expect, it } from "vitest";
import {
  type BrowserResult,
  type Finding,
  reviewSite,
  SimulatedReviewerAgent,
} from "../src/index.js";
import { cleanFiles, cleanHtml, fakeDist, fixture } from "./helpers.js";

const build = async () => ({ distDir: fakeDist(cleanHtml, cleanFiles) });
const browserSequence = (...rounds: Finding[][]) => {
  let call = 0;
  return async (): Promise<BrowserResult> => ({
    findings: rounds[Math.min(call++, rounds.length - 1)] ?? [],
    screenshots: [],
  });
};
const overflow: Finding = {
  check: "overflow",
  severity: "high",
  where: "servicos",
  width: 360,
  message: "x",
};

describe("reviewSite", () => {
  it("passes a clean site in one round", async () => {
    const report = await reviewSite({
      config: fixture(),
      form: fixture(),
      build,
      agent: new SimulatedReviewerAgent(),
      browser: browserSequence([]),
    });
    expect(report.status).toBe("passed");
    expect(report.rounds).toHaveLength(1);
  });

  it("swaps the section's variant for a layout problem and passes once it is gone", async () => {
    const report = await reviewSite({
      config: fixture(),
      form: fixture(),
      build,
      agent: new SimulatedReviewerAgent(),
      browser: browserSequence([overflow], []),
    });
    expect(report.status).toBe("passed");
    expect(report.rounds[0]?.fixes[0]).toMatch(/^servicos: variante trocada para /);
    expect(report.config.design.identity?.sectionVariants.servicos).not.toBe(
      fixture().design.identity?.sectionVariants.servicos,
    );
  });

  it("stops after 2 fix rounds and asks for a person when the problem stays", async () => {
    const report = await reviewSite({
      config: fixture(),
      form: fixture(),
      build,
      agent: new SimulatedReviewerAgent(),
      browser: browserSequence([overflow]),
    });
    expect(report.rounds).toHaveLength(3);
    expect(report.status).toBe("needsAttention");
  });

  it("rewrites the copy through the copy step when the agent asks for it", async () => {
    const config = fixture();
    const hero = config.sections.find((s) => s.id === "hero");
    if (hero?.id === "hero") hero.content.subtitle = "Desde 1985 no bairro";
    const calls: Finding[][] = [];
    const report = await reviewSite({
      config,
      form: fixture(),
      build,
      agent: new SimulatedReviewerAgent(),
      browser: browserSequence([]),
      rewriteCopy: async (_site, findings) => {
        calls.push(findings);
        return fixture();
      },
    });
    expect(calls[0]?.map((f) => f.check)).toContain("agent:invented-fact");
    expect(report.status).toBe("passed");
  });

  it("never loops on a security finding", async () => {
    const report = await reviewSite({
      config: fixture(),
      form: fixture(),
      build: async () => ({
        distDir: fakeDist(cleanHtml.replace("</main>", "<script>x()</script></main>"), cleanFiles),
      }),
      agent: new SimulatedReviewerAgent(),
      browser: browserSequence([]),
    });
    expect(report.status).toBe("needsAttention");
    expect(report.rounds).toHaveLength(1);
    expect(report.reason).toMatch(/segurança/);
  });

  it("repairs the client's colors to AA", async () => {
    const config = fixture();
    config.design.overrides = { colors: { text: "#EEEEEE" } };
    const report = await reviewSite({
      config,
      form: fixture(),
      build,
      agent: new SimulatedReviewerAgent(),
      browser: browserSequence([]),
    });
    expect(report.rounds[0]?.fixes).toContain("cores ajustadas para contraste AA");
    expect(report.status).toBe("passed");
  });

  it("leaves medium findings it cannot fix to the reviewer, as changes needed", async () => {
    const report = await reviewSite({
      config: fixture(),
      form: fixture(),
      build,
      agent: new SimulatedReviewerAgent(),
      browser: browserSequence([
        { check: "axe:region", severity: "medium", where: "page", message: "x" },
      ]),
    });
    expect(report.status).toBe("changesNeeded");
  });
});
