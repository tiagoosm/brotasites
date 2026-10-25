// The home page demo sends the visitor to /criar/negocio?nome=...&tipo=... (a GET form).
// Only these two answers travel in the address: a business name and a listed type.

const MAX_NAME = 80;

export interface DemoHandoff {
  name?: string;
  type?: string;
}

/** Reads the demo's answers from a query string, keeping only valid values. */
export function readDemoHandoff(search: string, typeIds: readonly string[]): DemoHandoff {
  const params = new URLSearchParams(search);
  const name = params.get("nome")?.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
  const type = params.get("tipo")?.trim();
  return {
    name: name && name.length >= 2 ? name : undefined,
    type: type && typeIds.includes(type) ? type : undefined,
  };
}
