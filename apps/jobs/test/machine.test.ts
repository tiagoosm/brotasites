import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/memory-store.js";
import { JOB_KINDS } from "../src/pipeline.js";
import {
  SITE_JOB_MACHINE,
  SITE_JOB_MAX_DURATION,
  SITE_JOB_OOM_MACHINE,
} from "../src/trigger/site-job.js";

// E37: the first real site-job was killed for running out of memory on the default machine.

/** Memory of each Trigger.dev machine preset, in GB (Trigger.dev's machines page). */
const MEMORY_GB: Record<string, number> = {
  micro: 0.25,
  "small-1x": 0.5,
  "small-2x": 1,
  "medium-1x": 2,
  "medium-2x": 4,
  "large-1x": 8,
  "large-2x": 16,
};

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("the site-job machine (E37)", () => {
  it("has at least 4 GB, and the out-of-memory retry has more", () => {
    expect(MEMORY_GB[SITE_JOB_MACHINE]).toBeGreaterThanOrEqual(4);
    expect(MEMORY_GB[SITE_JOB_OOM_MACHINE]).toBeGreaterThan(MEMORY_GB[SITE_JOB_MACHINE] ?? 0);
  });

  it("stops a run before the platform takes a running job as abandoned", () => {
    const source = readFileSync(join(root, "apps/platform/src/lib/stuck-job.ts"), "utf8");
    const minutes = Number(/STUCK_RUNNING_MINUTES = (\d+)/.exec(source)?.[1]);
    // The platform requeues a "running" job only well after the task's own limit.
    expect(minutes * 60).toBeGreaterThanOrEqual(SITE_JOB_MAX_DURATION + 10 * 60);
  });
});

describe("a job whose process was killed (E37)", () => {
  it("is put back in the queue for the next attempt, then claimed again", async () => {
    const store = new MemoryStore();
    store.jobs.push({
      id: "job-1",
      siteId: "site-1",
      kind: "directions",
      attempts: 0,
      payload: {},
      status: "queued",
    });
    const first = await store.claimJob(JOB_KINDS, "job-1");
    expect(first?.attempts).toBe(1);
    // The process dies here: the job stays "running" and no claim can take it.
    expect(await store.claimJob(JOB_KINDS, "job-1")).toBeNull();
    await store.requeueIfRunning("job-1", "out of memory");
    const second = await store.claimJob(JOB_KINDS, "job-1");
    expect(second?.attempts).toBe(2);
  });

  it("never touches a job that finished or is still queued", async () => {
    const store = new MemoryStore();
    store.jobs.push(
      { id: "done", siteId: "s", kind: "build", attempts: 1, payload: {}, status: "done" },
      { id: "queued", siteId: "s", kind: "build", attempts: 0, payload: {}, status: "queued" },
    );
    await store.requeueIfRunning("done", "x");
    await store.requeueIfRunning("queued", "x");
    expect(store.jobs.map((job) => [job.status, job.error])).toEqual([
      ["done", undefined],
      ["queued", undefined],
    ]);
  });
});
