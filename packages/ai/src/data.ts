// Client text always reaches the model as data, never as instructions (docs/ai-and-reviewer.md,
// AI security). It goes in as JSON inside a <client_data> block; "<", ">" and "&" are escaped
// as JSON unicode escapes, so nothing the client writes can close the block or open a new tag,
// and the model still reads the original characters.

export const DATA_TAG = "client_data";

export function escapeForTag(json: string): string {
  return json.replace(/[<>&\u2028\u2029]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

/** The data block a prompt carries. */
export function delimit(data: unknown): string {
  return `<${DATA_TAG}>\n${escapeForTag(JSON.stringify(data, null, 2))}\n</${DATA_TAG}>`;
}

/** JSON with sorted keys, so equal data always gives the same text (and the same cache key). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
