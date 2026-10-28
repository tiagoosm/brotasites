import { describe, expect, it } from "vitest";
import { catalogMetrics } from "./metrics";

const direction = (id: string, site: string, key: string, hero: string) => ({
  id,
  site_id: site,
  composition_key: key,
  identity: { heroVariant: hero, sectionVariants: { servicos: "servicos-menu" } },
});

describe("catalog metrics", () => {
  it("counts suggestions, choices, approvals, changes, findings, decisions and review time", () => {
    const metrics = catalogMetrics({
      directions: [
        direction("d1", "s1", "aaaaaaaaaaaaaaaa", "hero-feast"),
        direction("d2", "s1", "bbbbbbbbbbbbbbbb", "hero-split"),
        direction("d3", "s2", "aaaaaaaaaaaaaaaa", "hero-feast"),
      ],
      sites: [
        { id: "s1", approved_direction: "d1", approved_at: "2026-10-29T12:00:00Z" },
        { id: "s2", approved_direction: null, approved_at: null },
      ],
      reports: [
        { site_id: "s1", report: { findings: [{ severity: "medium" }, { severity: "low" }] } },
      ],
      decisions: [
        { site_id: "s1", action: "request_changes", created_at: "2026-10-29T09:00:00Z" },
        { site_id: "s1", action: "approve", created_at: "2026-10-29T11:00:00Z" },
      ],
      events: [
        { site_id: "s1", kind: "site_built", created_at: "2026-10-29T08:00:00Z" },
        { site_id: "s1", kind: "site_built", created_at: "2026-10-29T10:00:00Z" },
        { site_id: "s1", kind: "rebuild_requested", created_at: "2026-10-29T13:00:00Z" },
      ],
    });
    expect(metrics.compositions[0]).toEqual({
      key: "aaaaaaaaaaaaaaaa",
      suggested: 2,
      chosen: 1,
      approved: 1,
      changeRequests: 2,
      findings: { low: 1, medium: 1, high: 0 },
      decisions: 2,
      // 08:00 -> 11:00 and 10:00 -> 11:00.
      reviewHours: 2,
    });
    expect(metrics.compositions[1]).toMatchObject({
      key: "bbbbbbbbbbbbbbbb",
      suggested: 1,
      chosen: 0,
    });
    expect(metrics.variants.find((v) => v.id === "servicos-menu")).toMatchObject({
      suggested: 3,
      chosen: 1,
    });
    expect(metrics.variants.find((v) => v.id === "hero-split")).toMatchObject({
      suggested: 1,
      chosen: 0,
    });
  });
});
