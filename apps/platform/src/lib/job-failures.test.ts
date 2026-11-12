import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JobFailures } from "@/components/admin/job-failures";
import { adminJobs, failureNoteFor, failuresBySite, type JobRow } from "./job-failures";

const ENV = { ANTHROPIC_API_KEY: "plain-anthropic-value-123" };

function row(extra: Partial<JobRow> & Pick<JobRow, "id">): JobRow {
  return {
    kind: "build",
    status: "failed",
    attempts: 2,
    error: "page.evaluate: ReferenceError: __name is not defined",
    payload: { triggerRunId: "run_cm1abc2def3ghi" },
    created_at: "2026-11-12T10:00:00Z",
    started_at: "2026-11-12T10:00:05Z",
    finished_at: "2026-11-12T10:03:00Z",
    ...extra,
  };
}

describe("adminJobs (E39)", () => {
  it("masks again, explains, and sorts newest first", () => {
    const jobs = adminJobs(
      [
        row({ id: "old", created_at: "2026-11-11T10:00:00Z", error: "read ECONNRESET" }),
        row({
          id: "new",
          error: "boom with plain-anthropic-value-123 and sk-ant-api03-abcdef123456",
        }),
      ],
      ENV,
    );
    expect(jobs.map((job) => job.id)).toEqual(["new", "old"]);
    expect(jobs[0]?.error).toBe("boom with [oculto] and sk-[oculto]");
    expect(jobs[0]?.cause).toBeNull();
    expect(jobs[1]?.cause?.id).toBe("network");
    expect(jobs[0]?.step).toBe("Montar o site");
    expect(jobs[0]?.triggerRunId).toBe("run_cm1abc2def3ghi");
  });

  it("drops a run id that does not look like one", () => {
    const [job] = adminJobs(
      [row({ id: "a", payload: { triggerRunId: "javascript:alert(1)" } })],
      ENV,
    );
    expect(job?.triggerRunId).toBeNull();
  });

  it("keeps at most 2000 characters of a very long error", () => {
    const [job] = adminJobs(
      [row({ id: "a", error: `O build falhou:\n${"x ".repeat(3000)}` })],
      ENV,
    );
    expect(job?.error?.length).toBeLessThanOrEqual(2000);
    expect(job?.cause?.id).toBe("build");
  });
});

describe("failuresBySite and the history note (E39)", () => {
  it("gives each site its newest failure in a short line", () => {
    const map = failuresBySite(
      [
        {
          ...row({ id: "a", created_at: "2026-11-12T08:00:00Z", kind: "directions" }),
          site_id: "s1",
        },
        { ...row({ id: "b" }), site_id: "s1" },
        { ...row({ id: "c", status: "done", error: null }), site_id: "s2" },
      ],
      ENV,
    );
    expect(map.get("s1")).toMatchObject({ step: "Montar o site" });
    expect(map.get("s1")?.summary).toMatch(/__name/);
    expect(map.has("s2")).toBe(false);
  });

  it("adds the team's note to the job_failed entry closest in time", () => {
    const jobs = adminJobs([row({ id: "a" })], ENV);
    expect(failureNoteFor("2026-11-12T10:03:01Z", jobs)).toMatch(/^Montar o site: .*__name/);
    expect(failureNoteFor("2026-11-12T12:00:00Z", jobs)).toBeNull();
  });
});

describe("the O que deu errado section (E39)", () => {
  const render = (rows: JobRow[]) =>
    renderToStaticMarkup(createElement(JobFailures, { jobs: adminJobs(rows, ENV) }));

  it("is hidden when nothing failed", () => {
    expect(render([])).toBe("");
    expect(render([row({ id: "a", status: "done", error: null })])).toBe("");
  });

  it("shows the step, the cause, what to do, the details and the run", () => {
    const html = render([row({ id: "a" })]);
    expect(html).toContain("O que deu errado");
    expect(html).toContain("Montar o site");
    expect(html).toContain("2 tentativas");
    expect(html).toContain("O que fazer:");
    expect(html).toContain("Deploy jobs");
    expect(html).toContain("Detalhes técnicos");
    expect(html).toContain("Copiar os detalhes");
    expect(html).toContain("https://cloud.trigger.dev/runs/run_cm1abc2def3ghi");
    // Known cause: the technical block starts folded.
    expect(html).not.toMatch(/<details[^>]*open/);
  });

  it("says when the error is unknown and opens the raw text", () => {
    const html = render([row({ id: "a", error: "Algo estranho aconteceu", payload: {} })]);
    expect(html).toContain("Erro não reconhecido.");
    expect(html).toMatch(/<details[^>]*open/);
    expect(html).toContain("Algo estranho aconteceu");
    expect(html).toContain("Sem o id da execução");
  });

  it("lists several failures, newest first, at most 5", () => {
    const rows = Array.from({ length: 7 }, (_, i) =>
      row({
        id: `j${i}`,
        created_at: `2026-11-1${i}T10:00:00Z`,
        kind: i % 2 ? "directions" : "build",
      }),
    );
    const html = render(rows);
    expect(html.match(/<li/g)).toHaveLength(5);
    expect(html.indexOf("a falha mais recente")).toBeGreaterThan(-1);
  });
});
