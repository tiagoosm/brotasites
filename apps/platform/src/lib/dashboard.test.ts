import { describe, expect, it } from "vitest";
import { pricing } from "@/config/pricing";
import {
  addMonths,
  brazilDay,
  type DashboardSite,
  includedWindow,
  milestones,
  noticeHref,
  noticeText,
  pendingActions,
  resumeStep,
  siteAction,
} from "./dashboard";
import { isVariantPath, publicVariantPath } from "./public-variant";
import { statusInfo } from "./site-status";

const site = (patch: Partial<DashboardSite> = {}): DashboardSite => ({
  id: "7d1c1a52-2f0e-4c39-9a35-6b1f4a8e2c10",
  name: "Padaria do Zé",
  status: "draft",
  subdomain: null,
  statusMessage: null,
  createdAt: "2026-10-01T12:00:00Z",
  updatedAt: "2026-10-02T12:00:00Z",
  approvedAt: null,
  publishedAt: null,
  completed: [],
  directionsReadyAt: null,
  builtAt: null,
  ...patch,
});

describe("what publishing includes", () => {
  it("counts hosting and changes from the publishing day, in Brazil's calendar", () => {
    const window = includedWindow("2026-10-29T15:00:00Z", new Date("2026-11-08T15:00:00Z"));
    expect(window).toEqual({
      hostingUntil: "29/10/2027",
      hostingEnded: false,
      adjustmentDaysLeft: pricing.adjustmentsDays - 10,
    });
  });

  it("uses São Paulo's day, not UTC's", () => {
    // 01:30 UTC on Nov 1st is still Oct 31st at 22:30 in São Paulo.
    expect(brazilDay(new Date("2026-11-01T01:30:00Z"))).toEqual([2026, 10, 31]);
    const window = includedWindow("2026-11-01T01:30:00Z", new Date("2026-11-01T02:00:00Z"));
    expect(window?.hostingUntil).toBe("31/10/2027");
    expect(window?.adjustmentDaysLeft).toBe(pricing.adjustmentsDays);
  });

  it("turns the year and keeps short months right", () => {
    expect(includedWindow("2026-12-20T15:00:00Z", new Date("2027-01-04T15:00:00Z"))).toEqual({
      hostingUntil: "20/12/2027",
      hostingEnded: false,
      adjustmentDaysLeft: pricing.adjustmentsDays - 15,
    });
    expect(addMonths([2028, 2, 29], 12)).toEqual([2029, 2, 28]);
    expect(addMonths([2026, 1, 31], 1)).toEqual([2026, 2, 28]);
  });

  it("ends the changes window and the hosting", () => {
    const later = includedWindow("2026-01-10T15:00:00Z", new Date("2027-01-11T15:00:00Z"));
    expect(later?.adjustmentDaysLeft).toBe(0);
    expect(later?.hostingEnded).toBe(true);
  });

  it("is empty before publishing", () => {
    expect(includedWindow(null)).toBeNull();
    expect(includedWindow("not a date")).toBeNull();
  });
});

describe("pending actions", () => {
  it("puts the most urgent first and says where a draft stopped", () => {
    const actions = pendingActions({
      emailConfirmed: false,
      fullName: "",
      sites: [
        site({ id: "a", status: "draft", completed: ["negocio"] }),
        site({ id: "b", status: "awaiting_approval" }),
        site({ id: "c", status: "needs_attention", statusMessage: "Falta uma foto da fachada." }),
        site({ id: "d", status: "awaiting_direction_choice" }),
        site({ id: "e", status: "building" }),
        site({ id: "f", status: "live" }),
      ],
    });
    expect(actions.map((action) => action.key)).toEqual([
      "email",
      "site-c",
      "site-d",
      "site-b",
      "site-a",
      "profile",
    ]);
    expect(actions[1]?.text).toBe("Falta uma foto da fachada.");
    expect(actions[2]?.text).toBe(statusInfo.awaiting_direction_choice.text);
    expect(actions[4]?.text).toBe("Continue de onde parou: Marca e sensação.");
    expect(actions[4]?.href).toBe(`/criar/a/marca`);
  });

  it("is empty when everything is done", () => {
    expect(
      pendingActions({ emailConfirmed: true, fullName: "Zé", sites: [site({ status: "live" })] }),
    ).toEqual([]);
  });
});

describe("site cards", () => {
  it("offers the right button for the moment", () => {
    expect(siteAction(site({ status: "draft", completed: [] })).label).toBe("Continuar");
    expect(siteAction(site({ status: "awaiting_direction_choice" })).label).toBe(
      "Escolher direção",
    );
    expect(siteAction(site({ status: "awaiting_approval" })).label).toBe("Revisar");
    expect(siteAction(site({ status: "live" })).label).toBe("Baixar o site");
    expect(siteAction(site({ status: "building" })).label).toBe("Ver detalhes");
    expect(
      resumeStep(["negocio", "marca", "secoes", "conteudo", "contato", "direcao", "endereco"]).slug,
    ).toBe("negocio");
  });

  it("lists only the milestones that happened", () => {
    expect(milestones(site()).map((step) => step.label)).toEqual(["Criado"]);
    expect(
      milestones(
        site({
          directionsReadyAt: "2026-10-03T12:00:00Z",
          builtAt: "2026-10-04T12:00:00Z",
          approvedAt: "2026-10-05T12:00:00Z",
          publishedAt: "2026-10-05T13:00:00Z",
        }),
      ).map((step) => step.label),
    ).toEqual(["Criado", "Direções prontas", "Em revisão", "Aprovado", "Publicado"]);
  });
});

describe("notices", () => {
  it("writes each kind's sentence from the kind, never stored text", () => {
    expect(noticeText("directions_ready", "Padaria do Zé")).toBe(
      "As 3 direções de Padaria do Zé estão prontas.",
    );
    expect(noticeText("site_published", undefined)).toBe("Seu site está no ar.");
    expect(noticeText("email_confirmed", "x")).toBe("Seu e-mail foi confirmado.");
    expect(noticeText("site_suspended", "Padaria")).toContain("Veja os motivos na página do site");
  });

  it("leads to the right page", () => {
    expect(noticeHref({ kind: "site_published", siteId: "abc" })).toBe("/meus-sites/abc");
    expect(noticeHref({ kind: "email_confirmed", siteId: null })).toBe("/painel");
  });
});

describe("public pages per session", () => {
  it("serves the visitor or signed-in page under the same address", () => {
    expect(publicVariantPath("/", false)).toBe("/visitante");
    expect(publicVariantPath("/", true)).toBe("/logado");
    expect(publicVariantPath("/ajuda", true)).toBe("/logado/ajuda");
    expect(publicVariantPath("/ajuda/", false)).toBe("/visitante/ajuda");
    expect(publicVariantPath("/painel", true)).toBeNull();
    expect(publicVariantPath("/conta", true)).toBeNull();
  });

  it("never serves the internal addresses themselves", () => {
    expect(isVariantPath("/logado")).toBe(true);
    expect(isVariantPath("/visitante/ajuda")).toBe(true);
    expect(isVariantPath("/conta")).toBe(false);
    expect(isVariantPath("/")).toBe(false);
  });
});
