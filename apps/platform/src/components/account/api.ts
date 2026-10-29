"use client";

// The account pages talk to the platform's own routes (/api/auth, /api/account) with JSON.

export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T & { error?: string; fields?: Record<string, string>; reauth?: boolean };
}

export async function postJson<T = Record<string, unknown>>(
  url: string,
  body: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as ApiResult<T>["data"];
    return { ok: response.ok, status: response.status, data };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "Sem conexão. Confira a internet e tente de novo." } as ApiResult<T>["data"],
    };
  }
}
