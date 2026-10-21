import type { FormStepSlug, SiteDraft } from "@brotasites/schema";
import type { SupabaseClient } from "@supabase/supabase-js";

// Keeps the draft in the person's account once they sign in (tables in supabase/migrations).

export interface StoredDraft {
  draft: SiteDraft;
  completed: FormStepSlug[];
  /** Milliseconds since epoch of the last change; decides which copy wins. */
  updatedAt: number;
}

export interface RemoteDraft extends StoredDraft {
  siteId: string;
}

export function isEmptyDraft(stored: StoredDraft): boolean {
  return stored.completed.length === 0 && Object.keys(stored.draft).length === 0;
}

/**
 * Which copy to keep when someone signs in: the newer one, but never let an empty copy
 * replace real answers (a fresh device must not wipe the account, and vice versa).
 */
export function chooseDraft(local: StoredDraft, remote: StoredDraft | null): "local" | "remote" {
  if (!remote || isEmptyDraft(remote)) return "local";
  if (isEmptyDraft(local)) return "remote";
  return remote.updatedAt > local.updatedAt ? "remote" : "local";
}

/** The person's most recent draft site, if any. RLS limits the query to their own rows. */
export async function fetchRemoteDraft(supabase: SupabaseClient): Promise<RemoteDraft | null> {
  const { data, error } = await supabase
    .from("sites")
    .select("id, site_configs(draft, completed, updated_at)")
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const config = Array.isArray(data?.site_configs) ? data.site_configs[0] : data?.site_configs;
  if (!data || !config)
    return data ? { siteId: data.id, draft: {}, completed: [], updatedAt: 0 } : null;
  return {
    siteId: data.id,
    draft: (config.draft ?? {}) as SiteDraft,
    completed: (config.completed ?? []) as FormStepSlug[],
    updatedAt: Date.parse(config.updated_at) || 0,
  };
}

/** Saves the draft, creating the site on first save. Returns the site id. */
export async function pushRemoteDraft(
  supabase: SupabaseClient,
  siteId: string | null,
  stored: StoredDraft,
): Promise<string> {
  let id = siteId;
  if (!id) {
    const { data, error } = await supabase.from("sites").insert({}).select("id").single();
    if (error) throw error;
    id = data.id as string;
  }
  // Update first, insert when there is no row yet. (An upsert would also try to update
  // site_id, which clients are not allowed to change.)
  const changes = { draft: stored.draft, completed: stored.completed };
  const updated = await supabase
    .from("site_configs")
    .update(changes)
    .eq("site_id", id)
    .select("site_id");
  if (updated.error) throw updated.error;
  if (updated.data.length === 0) {
    const inserted = await supabase.from("site_configs").insert({ site_id: id, ...changes });
    if (inserted.error) throw inserted.error;
  }
  return id;
}
