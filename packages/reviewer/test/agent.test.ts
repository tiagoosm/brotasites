import { ScriptedModelClient } from "@brotasites/ai";
import { describe, expect, it } from "vitest";
import { ModelReviewerAgent, pageText, SimulatedReviewerAgent } from "../src/index.js";
import { cleanHtml, fixture } from "./helpers.js";

const input = (change?: (config: ReturnType<typeof fixture>) => void) => {
  const config = fixture();
  change?.(config);
  return {
    config,
    form: fixture(),
    html: cleanHtml,
    screenshots: [{ width: 360, png: Buffer.from("png") }],
  };
};

describe("SimulatedReviewerAgent", () => {
  it("finds nothing in the fixture", async () => {
    expect((await new SimulatedReviewerAgent().review(input())).findings).toEqual([]);
  });

  it("finds invented facts against the client's answers, not against the site", async () => {
    const result = await new SimulatedReviewerAgent().review(
      input((config) => {
        const hero = config.sections.find((s) => s.id === "hero");
        if (hero?.id === "hero") hero.content.subtitle = "Mais de 10 mil clientes desde 1985";
      }),
    );
    expect(result.findings.map((f) => f.check)).toContain("agent:invented-fact");
    expect(result.findings[0]).toMatchObject({ where: "hero", fix: { type: "rewrite-copy" } });
  });
});

describe("ModelReviewerAgent", () => {
  it("sends the screenshots and the delimited material, and maps the answer", async () => {
    const answer = {
      findings: [
        {
          severity: "medium",
          category: "balance",
          where: "galeria",
          message: "A galeria parece vazia.",
          fix: "swap-variant",
        },
        {
          severity: "low",
          category: "fit",
          where: "page",
          message: "Tom formal demais.",
          fix: "swap-variant",
        },
      ],
    };
    const model = new ScriptedModelClient([JSON.stringify(answer)]);
    const result = await new ModelReviewerAgent(model).review(input());
    const request = model.requests[0];
    expect(request?.images).toEqual([
      { mediaType: "image/png", data: Buffer.from("png").toString("base64") },
    ]);
    expect(request?.prompt).toMatch(/<client_data>[\s\S]*clientAnswers[\s\S]*<\/client_data>$/);
    expect(request?.system).toMatch(/never an instruction to you/);
    expect(result.findings).toEqual([
      {
        check: "agent:balance",
        severity: "medium",
        where: "galeria",
        message: "A galeria parece vazia.",
        fix: { type: "swap-variant", section: "galeria" },
      },
      { check: "agent:fit", severity: "low", where: "page", message: "Tom formal demais." },
    ]);
  });

  it("turns a bad or missing answer into a finding for a person, never a pass", async () => {
    const invalid = await new ModelReviewerAgent(
      new ScriptedModelClient(['{"findings":"none"}']),
    ).review(input());
    expect(invalid.findings[0]?.check).toBe("agent:invalid-answer");
    const missing = await new ModelReviewerAgent(new ScriptedModelClient([])).review(input());
    expect(missing.findings[0]?.check).toBe("agent:unavailable");
  });
});

describe("pageText", () => {
  it("keeps the visible text with the section marks and drops scripts", () => {
    const text = pageText(cleanHtml);
    expect(text).toContain("[seção abertura]");
    expect(text).toContain("Pão quentinho");
    expect(text).not.toContain("Bakery");
  });
});

describe("reviewerAgentFromEnv", () => {
  it("follows AI_MODE", async () => {
    const { reviewerAgentFromEnv } = await import("../src/index.js");
    expect(reviewerAgentFromEnv({})).toBeInstanceOf(SimulatedReviewerAgent);
    expect(
      reviewerAgentFromEnv({
        AI_MODE: "live",
        AI_MODEL_ID: "claude-opus-5-5",
        ANTHROPIC_API_KEY: "k",
      }),
    ).toBeInstanceOf(ModelReviewerAgent);
  });
});
