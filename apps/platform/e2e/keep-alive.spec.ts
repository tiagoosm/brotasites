import { expect, test } from "@playwright/test";

// The daily keep-alive (Vercel Cron): only the cron's bearer token runs it, and it only reads.

test("the keep-alive answers only to the cron's secret", async ({ request }) => {
  const path = "/api/cron/keep-alive";
  expect((await request.get(path)).status()).toBe(401);
  expect((await request.get(path, { headers: { authorization: "Bearer wrong" } })).status()).toBe(
    401,
  );
  const response = await request.get(path, {
    headers: { authorization: "Bearer e2e-cron-secret" },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(body.queries.map((query: { table: string }) => query.table)).toEqual([
    "sites",
    "profiles",
    "notifications",
  ]);
  // Never writes: other methods are not routes.
  expect(
    (await request.post(path, { headers: { origin: "http://localhost:3100" } })).status(),
  ).toBe(405);
});
