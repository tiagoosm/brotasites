import { describe, expect, it } from "vitest";
import {
  envSecrets,
  explainJobError,
  JOB_ERROR_CAUSES,
  JOB_ERROR_MAX,
  maskJobError,
  shortJobError,
} from "./job-error.js";

describe("maskJobError (E39)", () => {
  it("hides keys, tokens and passwords by their shape", () => {
    const raw = [
      "Anthropic key sk-ant-api03-abcDEF123456_xyz failed",
      "trigger tr_prod_AbC123def456 and tr_pat_zzz999yyy888",
      "Authorization: Bearer abc.def-ghi_123",
      "apikey=sb_secret_0123456789abcdef&x=1",
      '{"api_key": "supersecretvalue1"} x-api-key: plainkey12345 password=hunter2hunter2',
      "jwt eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.c2lnbmF0dXJl",
      "postgres://postgres:p4ssw0rd@db.example.co:5432/postgres",
      `blob ${"QUJDRA".repeat(10)}1==`,
    ].join("\n");
    const masked = maskJobError(raw);
    for (const leak of [
      "sk-ant-api03",
      "AbC123def456",
      "zzz999yyy888",
      "abc.def-ghi_123",
      "0123456789abcdef",
      "supersecretvalue1",
      "plainkey12345",
      "hunter2hunter2",
      "eyJhbGci",
      "p4ssw0rd",
      "QUJDRAQUJDRA",
    ]) {
      expect(masked).not.toContain(leak);
    }
    expect(masked).toContain("Bearer [oculto]");
    expect(masked).toContain("postgres://[oculto]@db.example.co:5432/postgres");
    expect(masked).toContain("[jwt oculto]");
    expect(masked).toContain("[dados ocultos]");
  });

  it("hides the values of the environment's secrets, whatever their shape", () => {
    const secrets = envSecrets({
      ANTHROPIC_API_KEY: "plain-value-without-shape",
      SUPABASE_SECRET_KEY: "another one here",
      AI_MODE: "live",
      SHORT_TOKEN: "abc",
      PUBLIC_URL: "https://brotasites.com.br",
    });
    expect(secrets).toEqual(["plain-value-without-shape", "another one here"]);
    expect(maskJobError("got plain-value-without-shape and another one here", secrets)).toBe(
      "got [oculto] and [oculto]",
    );
  });

  it("keeps the readable parts: messages, paths and stack lines", () => {
    const raw =
      "ReferenceError: __name is not defined\n    at eval (eval at evaluate (/app/node_modules/playwright-core/lib/server/injected.js:1:2))";
    expect(maskJobError(raw)).toBe(raw);
  });

  it("collapses runs of blank lines and trims trailing spaces", () => {
    expect(maskJobError("one  \r\n\r\n\r\n\r\ntwo\n\n\n\nthree\n")).toBe("one\n\ntwo\n\nthree");
  });

  it("keeps at most JOB_ERROR_MAX characters: the start and the end", () => {
    const raw = `START ${"linha do log de build\n".repeat(400)} END`;
    const masked = maskJobError(raw);
    expect(masked.length).toBeLessThanOrEqual(JOB_ERROR_MAX);
    expect(masked.startsWith("START")).toBe(true);
    expect(masked.endsWith("END")).toBe(true);
    expect(masked).toMatch(/\[… \d+ caracteres omitidos …\]/);
  });

  it("accepts errors and other values", () => {
    expect(maskJobError(new Error("boom"))).toBe("boom");
    expect(maskJobError(undefined)).toBe("");
  });
});

describe("explainJobError (E39)", () => {
  const cases: [string, string][] = [
    ["page.evaluate: ReferenceError: __name is not defined", "keep-names"],
    ["TASK_PROCESS_OOM_KILLED: the process ran out of memory", "memory"],
    ["FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory", "memory"],
    ["page.goto: Target crashed", "memory"],
    ["O processo parou sem terminar a tarefa.", "stopped"],
    [
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low"}}',
      "anthropic-credit",
    ],
    [
      '401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}',
      "anthropic-auth",
    ],
    ['new row violates row-level security policy for table "site_directions"', "supabase"],
    ["StorageApiError: Bucket not found", "supabase"],
    ["JWSError JWSInvalidSignature", "supabase"],
    ["R2 upload failed: AccessDenied", "cloudflare"],
    ["KV put failed: 10000 Authentication error (api.cloudflare.com)", "cloudflare"],
    [
      "O build falhou:\n[astro] TypeError: fetch failed (fonts)\nError: Cannot find module",
      "build",
    ],
    ["read ECONNRESET", "network"],
    ["Request timed out after 600000ms", "network"],
  ];
  it.each(cases)("%s -> %s", (text, id) => {
    expect(explainJobError(maskJobError(text))?.id).toBe(id);
  });

  it("does not take a masked token for a Supabase error", () => {
    expect(
      explainJobError(maskJobError("Something odd with eyJhbGciOiJIUzI1NiJ9.e30.x")),
    ).toBeNull();
  });

  it("says nothing for an unknown error", () => {
    expect(explainJobError("Something odd happened")).toBeNull();
    expect(explainJobError(null)).toBeNull();
  });

  it("every cause has a summary and a next step in Portuguese", () => {
    for (const cause of JOB_ERROR_CAUSES) {
      expect(cause.summary.length).toBeGreaterThan(10);
      expect(cause.action.length).toBeGreaterThan(10);
    }
  });

  it("gives one short line for lists", () => {
    expect(shortJobError("ReferenceError: __name is not defined")).toMatch(/__name/);
    expect(shortJobError(`\n  Erro estranho ${"x".repeat(200)}`, 40)).toHaveLength(40);
    expect(shortJobError("")).toBeNull();
  });
});
