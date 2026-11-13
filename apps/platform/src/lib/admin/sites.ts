// The team's list of published sites (E42): one row, and the address search.

export interface AdminSiteRow {
  id: string;
  subdomain: string | null;
  name: string | null;
  status: string;
  offlineBy: string | null;
  deleteAfter: string | null;
  deletionBy: string | null;
  deletionAttempts: number;
  deletionError: string | null;
  publishedAt: string | null;
}

/** Escapes the search for an ilike pattern inside a PostgREST filter. */
export function addressPattern(query: string): string | null {
  const clean = query
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(".")[0]
    ?.replace(/[^a-z0-9-]/g, "");
  return clean ? `%${clean}%` : null;
}
