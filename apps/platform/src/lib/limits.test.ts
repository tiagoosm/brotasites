import { describe, expect, it } from "vitest";
import { brasiliaTime, limits } from "@/config/limits";
import { budgetLevel } from "@/lib/admin/budget";
import { daysUntil, IDLE_STATUSES, idleDeadline, noticeText } from "@/lib/dashboard";
import { deletionNotice, nextRoundAt, redoUsage } from "@/lib/limits-copy";

// The cost limits (E24): the idle rule as the dashboard shows it, and the sentences around the
// limits. The database applies the same rule (supabase/tests/cost_limits.sql).

const DAY = 86_400_000;

describe("idle deadline", () => {
  const last = "2026-11-01T15:00:00Z";

  it("is 30 days after the person's last action", () => {
    const deadline = idleDeadline({ status: "draft", lastActivityAt: last });
    expect(deadline?.toISOString()).toBe(new Date(Date.parse(last) + 30 * DAY).toISOString());
    expect(limits.idleDaysBeforeDeletion).toBe(30);
  });

  it("applies only while the site waits on the person", () => {
    for (const status of IDLE_STATUSES) {
      expect(idleDeadline({ status, lastActivityAt: last })).not.toBeNull();
    }
    // Waiting on us, paid, published, suspended, in grace: never.
    for (const status of [
      "generating_directions",
      "building",
      "in_review",
      "publishing",
      "live",
      "suspended",
      "grace",
    ]) {
      expect(idleDeadline({ status, lastActivityAt: last })).toBeNull();
    }
  });

  it("in doubt (no date, a bad date), never", () => {
    expect(idleDeadline({ status: "draft", lastActivityAt: null })).toBeNull();
    expect(idleDeadline({ status: "draft", lastActivityAt: "ontem" })).toBeNull();
  });

  it("a later date from the team wins; an earlier one does not shorten it", () => {
    const later = "2026-12-20T12:00:00Z";
    expect(
      idleDeadline({ status: "draft", lastActivityAt: last, keepUntil: later })?.toISOString(),
    ).toBe(new Date(later).toISOString());
    const earlier = "2026-11-05T12:00:00Z";
    expect(
      idleDeadline({ status: "draft", lastActivityAt: last, keepUntil: earlier })?.getTime(),
    ).toBe(Date.parse(last) + 30 * DAY);
  });

  it("counts days in Brazil's calendar (America/Sao_Paulo)", () => {
    // 02:30 UTC on Dec 1 is still Nov 30 in Brasília.
    const now = new Date("2026-12-01T02:30:00Z");
    expect(daysUntil(new Date("2026-12-01T12:00:00Z"), now)).toBe(1);
    expect(daysUntil(new Date("2026-12-01T02:00:00Z"), now)).toBe(0);
    expect(daysUntil(new Date("2026-11-01T00:00:00Z"), now)).toBe(0);
  });
});

describe("the sentences of the limits", () => {
  it("counts redos, not the first round", () => {
    expect(redoUsage(1, 3)).toBe("Você usou 0 de 2 refazeres grátis.");
    expect(redoUsage(3, 3)).toBe("Você usou 2 de 2 refazeres grátis.");
    expect(redoUsage(5, 3)).toBe("Você usou 2 de 2 refazeres grátis.");
    expect(redoUsage(2, 2)).toBe("Você usou 1 de 1 refazer grátis.");
  });

  it("says when the next round opens, in Brasília time", () => {
    const now = new Date("2026-11-03T17:00:00Z");
    expect(nextRoundAt(new Date("2026-11-03T18:40:00Z"), now)).toBe(
      "Próxima rodada disponível às 15h40.",
    );
    expect(brasiliaTime(new Date("2026-11-04T18:40:00Z"), now)).toBe("04/11 às 15h40");
  });

  it("warns before the deletion without alarm", () => {
    expect(deletionNotice(7)).toBe("Este site será apagado em 7 dias se não houver novidades.");
    expect(deletionNotice(1)).toBe("Este site será apagado amanhã se não houver novidades.");
    expect(noticeText("site_deletion_warning", "Padaria do Zé", 7)).toBe(
      "Padaria do Zé será apagado em 7 dias se não houver novidades.",
    );
  });
});

describe("daily budget", () => {
  it("marks the alert at 80% and over at 100%", () => {
    const budget = { dailyBudgetUsd: 20, alertRatio: 0.8 };
    expect(budgetLevel(10, budget).level).toBe("ok");
    expect(budgetLevel(16, budget).level).toBe("alert");
    expect(budgetLevel(20, budget).level).toBe("over");
  });
});
