import { describe, expect, it } from "vitest";
import {
  type BrowserResult,
  type Finding,
  type ReviewerAgent,
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
    // E46: rewritten once; the note stays for the person who reviews the site.
    expect(calls).toHaveLength(1);
    expect(report.status).toBe("changesNeeded");
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
    expect(report.releasable).toBe(false);
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

  // E46: a real agent almost always finds something, and rarely the same words twice.
  describe("the agent's findings are notes for the person, not a reason to hold the site", () => {
    const opinions = (): Finding[] => [
      {
        check: "agent:fit",
        severity: "high",
        where: "hero",
        message: "O tom do título não combina com uma padaria.",
        fix: { type: "rewrite-copy" },
      },
      {
        check: "agent:generic-copy",
        severity: "medium",
        where: "sobre",
        message: "Texto genérico.",
        fix: { type: "rewrite-copy" },
      },
    ];
    /** An agent that says the same thing every round, counting its calls. */
    const stubborn = (findings: () => Finding[] = opinions) => {
      const agent = {
        calls: 0,
        async review() {
          agent.calls++;
          return { findings: findings(), costUsd: 0.05, source: "model" as const };
        },
      } satisfies ReviewerAgent & { calls: number };
      return agent;
    };

    it("rewrites once, keeps the notes and sends the site on to the person (no needsAttention)", async () => {
      const agent = stubborn();
      let rewrites = 0;
      const lines: string[] = [];
      const report = await reviewSite({
        config: fixture(),
        form: fixture(),
        build,
        agent,
        browser: browserSequence([]),
        rewriteCopy: async (site) => {
          rewrites++;
          return site;
        },
        log: (line) => lines.push(line),
      });
      expect(report.status).toBe("changesNeeded");
      expect(report.reason).toMatch(/revisor automático/);
      expect(rewrites).toBe(1);
      // Only its own notes were fixed: it is not asked again.
      expect(agent.calls).toBe(1);
      expect(report.rounds.map((round) => round.agent)).toEqual([true, false]);
      expect(report.findings.map((f) => [f.check, f.origin, f.blocking])).toEqual([
        ["agent:fit", "agent", false],
        ["agent:generic-copy", "agent", false],
      ]);
      expect(lines[0]).toBe("review round 0: 0 check, 2 (fit, generic-copy) agent");
      expect(lines[1]).toBe("review round 1: 0 check, skipped agent");
    });

    it("asks again after a measured fix, and does not rewrite the same note twice", async () => {
      const agent = stubborn();
      let rewrites = 0;
      const report = await reviewSite({
        config: fixture(),
        form: fixture(),
        build,
        agent,
        browser: browserSequence([overflow], []),
        rewriteCopy: async (site) => {
          rewrites++;
          return site;
        },
      });
      expect(agent.calls).toBe(2);
      expect(rewrites).toBe(1);
      expect(report.rounds).toHaveLength(2);
      expect(report.status).toBe("changesNeeded");
    });

    it("holds a high note when no person will look (REVIEW_SKIP_HUMAN)", async () => {
      const agent = stubborn();
      const report = await reviewSite({
        config: fixture(),
        form: fixture(),
        build,
        agent,
        browser: browserSequence([]),
        rewriteCopy: async (site) => site,
        humanReview: false,
      });
      expect(agent.calls).toBe(2);
      expect(report.status).toBe("needsAttention");
      expect(report.findings.find((f) => f.check === "agent:fit")?.blocking).toBe(true);
      expect(report.findings.find((f) => f.check === "agent:generic-copy")?.blocking).toBe(false);
    });

    it("still holds a deterministic problem that stays, and marks it as the reason", async () => {
      const report = await reviewSite({
        config: fixture(),
        form: fixture(),
        build,
        agent: stubborn(),
        browser: browserSequence([overflow]),
        rewriteCopy: async (site) => site,
      });
      expect(report.status).toBe("needsAttention");
      expect(report.releasable).toBe(true);
      const held = report.findings.filter((f) => f.blocking);
      expect(held.map((f) => [f.check, f.origin])).toEqual([["overflow", "check"]]);
    });

    it("an agent that did not answer is a note, never a hold", async () => {
      const unavailable = stubborn(() => [
        {
          check: "agent:unavailable",
          severity: "medium",
          where: "page",
          message: "O revisor automático não respondeu; revise à mão.",
        },
      ]);
      const report = await reviewSite({
        config: fixture(),
        form: fixture(),
        build,
        agent: unavailable,
        browser: browserSequence([]),
        humanReview: false,
      });
      expect(report.status).toBe("changesNeeded");
    });
  });
});
