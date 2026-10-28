// Calls from the admin pages to the admin route handlers. Errors carry the server's pt-BR text.

export class AdminError extends Error {}

export async function adminGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new AdminError((body as { error?: string }).error ?? "Falha ao carregar.");
  return body as T;
}

export async function adminPost<T = unknown>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new AdminError((body as { error?: string }).error ?? "Não foi possível salvar.");
  return body as T;
}
