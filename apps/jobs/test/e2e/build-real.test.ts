import { describe, expect, it } from "vitest";
import { playwrightScreenshotter } from "../../src/screenshots.js";
import { runNext, setup } from "../setup.js";

// E46: the whole build path with the real Astro and the real Chromium (the reviewer's browser
// checks and the card screenshots), only the AI simulated. It catches what the unit tests cannot
// see, such as the __name of E39. Set PW_CHROMIUM to use a specific Chromium binary.
describe("the real build", { timeout: 900_000 }, () => {
  it("goes from the answers to a reviewed preview with the real Astro and Chromium", async () => {
    const { store, siteId, deps, uploads } = setup();
    const screenshot = playwrightScreenshotter();
    deps.screenshot = screenshot;
    deps.browserChecks = undefined;
    const lines: string[] = [];
    deps.log = (line) => lines.push(line);
    try {
      store.enqueue(siteId, "directions");
      expect(await runNext(deps, store)).toBe("done");
      const directions = store.directions.filter((d) => d.siteId === siteId);
      await store.updateSite(siteId, { status: "building" });
      const record = store.sites.get(siteId);
      if (record) record.approvedDirection = directions[1]?.id ?? null;
      store.enqueue(siteId, "build");
      expect(await runNext(deps, store), lines.join("\n")).toBe("done");
      expect((await store.loadSite(siteId)).status).toBe("in_review");
      expect(store.reports[0]?.status).toBe("passed");
      expect(uploads).toHaveLength(1);
      expect(lines[0]).toMatch(/^review round 0: /);
    } finally {
      await screenshot.close();
    }
  });
});
