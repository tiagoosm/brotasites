import type { FormDraft, RedoFeedback } from "@brotasites/schema/v1.2";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobState } from "@/lib/stuck-job";
import { hosts } from "./domains/hosts";

// The client's sites, read through Supabase with the person's session (RLS: only their own).
// State changes go through the database functions (request_directions, choose_direction,
// request_rebuild) or the platform's route handlers, never by writing status directly.

export interface SiteRow {
  id: string;
  subdomain: string | null;
  status: string;
  round: number;
  schema_version: string;
  status_message: string | null;
  preview_token: string | null;
  approved_direction: string | null;
  /** E42: who took the site offline (owner, admin, system), while it is offline. */
  offline_by?: "owner" | "admin" | "system" | null;
  /** E42: the reason the team chose to show the client, if any. */
  offline_public_reason?: string | null;
  /** E42: when a scheduled deletion happens, and who scheduled it. */
  delete_after?: string | null;
  deletion_by?: "owner" | "admin" | null;
  created_at: string;
  updated_at: string;
}

export interface SiteWithDraft extends SiteRow {
  draft: FormDraft;
  completed: string[];
}

export interface DirectionRow {
  id: string;
  round: number;
  direction: "fiel-a-marca" | "evolucao" | "contraste";
  identity: {
    personality: string;
    palette: Record<string, string>;
    fontPair: string;
    heroVariant: string;
  };
  source: "ai" | "engine";
  screenshots: string[];
}

export interface EventRow {
  id: number;
  kind: string;
  message: string;
  created_at: string;
}

const SITE_COLUMNS =
  "id, subdomain, status, round, schema_version, status_message, preview_token, approved_direction, offline_by, offline_public_reason, delete_after, deletion_by, created_at, updated_at";

export const directionLabels: Record<DirectionRow["direction"], string> = {
  "fiel-a-marca": "Fiel à marca",
  evolucao: "Evolução",
  contraste: "Contraste",
};

export async function listSites(
  supabase: SupabaseClient,
): Promise<(SiteRow & { name?: string })[]> {
  const { data, error } = await supabase
    .from("sites")
    .select(`${SITE_COLUMNS}, site_configs(draft)`)
    .eq("schema_version", "1.2")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { site_configs, ...site } = row as SiteRow & {
      site_configs: { draft: FormDraft } | { draft: FormDraft }[] | null;
    };
    const config = Array.isArray(site_configs) ? site_configs[0] : site_configs;
    return { ...site, name: config?.draft?.business?.name };
  });
}

export async function loadSite(
  supabase: SupabaseClient,
  siteId: string,
): Promise<SiteWithDraft | null> {
  const { data, error } = await supabase
    .from("sites")
    .select(`${SITE_COLUMNS}, site_configs(draft, completed)`)
    .eq("id", siteId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { site_configs, ...site } = data as SiteRow & {
    site_configs:
      | { draft: FormDraft; completed: string[] }
      | { draft: FormDraft; completed: string[] }[]
      | null;
  };
  const config = Array.isArray(site_configs) ? site_configs[0] : site_configs;
  return { ...site, draft: config?.draft ?? {}, completed: config?.completed ?? [] };
}

/** Why a new site could not start: the account already has one in progress (E24). */
export class SiteInProgressError extends Error {
  constructor(
    message: string,
    readonly siteId: string | null,
  ) {
    super(message);
  }
}

/** A new 1.2 site with an empty draft, through the server (one unpaid site in progress). */
export async function createSite(): Promise<string> {
  const response = await fetch("/api/sites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: string;
    siteId?: string | null;
  };
  if (response.status === 409) {
    throw new SiteInProgressError(body.error ?? "", body.siteId ?? null);
  }
  if (!response.ok || !body.id) throw new Error("site not created");
  return body.id;
}

export async function saveDraft(
  supabase: SupabaseClient,
  siteId: string,
  draft: FormDraft,
  completed: string[],
): Promise<void> {
  const { error } = await supabase
    .from("site_configs")
    .update({ draft, completed })
    .eq("site_id", siteId);
  if (error) throw error;
}

export async function loadDirections(
  supabase: SupabaseClient,
  siteId: string,
  round: number,
): Promise<DirectionRow[]> {
  const { data, error } = await supabase
    .from("site_directions")
    .select("id, round, direction, identity, source, screenshots")
    .eq("site_id", siteId)
    .eq("round", round);
  if (error) throw error;
  const order = ["fiel-a-marca", "evolucao", "contraste"];
  return ((data ?? []) as DirectionRow[]).sort(
    (a, b) => order.indexOf(a.direction) - order.indexOf(b.direction),
  );
}

/** The site's latest job (RLS: the owner's own), to tell a stuck one (E34, lib/stuck-job.ts). */
export async function loadLatestJob(
  supabase: SupabaseClient,
  siteId: string,
): Promise<JobState | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, status, created_at, started_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as JobState | null) ?? null;
}

/** Asks for a queued job to start again (E34); false when it still cannot start. */
export async function retryJob(jobId: string): Promise<boolean> {
  const response = await fetch("/api/jobs/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  if (!response.ok) return false;
  const body = (await response.json().catch(() => ({}))) as { started?: boolean };
  return body.started === true;
}

export async function loadEvents(supabase: SupabaseClient, siteId: string): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("site_events")
    .select("id, kind, message, created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

const rpcErrors: Record<string, string> = {
  site_not_found: "Não encontramos este site na sua conta. Entre de novo e tente outra vez.",
  wrong_status: "Este passo não está disponível agora. Atualize a página.",
  rate_limited: "Você chegou ao limite de pedidos de hoje. Tente de novo amanhã.",
  direction_not_found: "Essa direção não está mais disponível. Atualize a página.",
  needs_v12: "Este site foi criado na versão antiga. Crie um novo site.",
  directions_wait: "Você já usou os refazeres grátis. Tente de novo mais tarde.",
  email_not_confirmed:
    "Confirme o seu e-mail para ver as 3 direções. Toque no link que enviamos quando você criou a conta.",
};

export class SiteActionError extends Error {}

async function rpc(
  supabase: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const code = Object.keys(rpcErrors).find((key) => error.message?.includes(key));
    throw new SiteActionError(
      code
        ? (rpcErrors[code] as string)
        : "Não foi possível fazer isso agora. Tente de novo em instantes.",
    );
  }
  return data as string;
}

/** Starts the job right away (Trigger.dev); without it, the local runner takes it from the queue. */
async function startJob(jobId: string): Promise<void> {
  await fetch("/api/jobs/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  }).catch(() => {});
}

/** Rounds of directions used and free, and when the next one opens (E24). */
export interface DirectionsQuota {
  used: number;
  free: number;
  availableAt: string | null;
}

export async function loadDirectionsQuota(
  supabase: SupabaseClient,
  siteId: string,
): Promise<DirectionsQuota | null> {
  const { data, error } = await supabase.rpc("directions_quota", { p_site_id: siteId });
  if (error || !data) return null;
  return data as DirectionsQuota;
}

/** Asks for a round of directions; the server decides with the limits (and starts the job). */
export async function requestDirections(siteId: string, feedback?: RedoFeedback): Promise<void> {
  const response = await fetch(`/api/sites/${siteId}/directions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // E41: what the client did not like about the last round, when they said.
    body: JSON.stringify(feedback ? { feedback } : {}),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new SiteActionError(
      body.error ?? "Não foi possível fazer isso agora. Tente de novo em instantes.",
    );
  }
}

/** Discards an unpaid site and everything in it (after the person confirmed). */
export async function discardSite(siteId: string): Promise<void> {
  const response = await fetch(`/api/sites/${siteId}/discard`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new SiteActionError(
      body.error ?? "Não foi possível descartar agora. Tente de novo em instantes.",
    );
  }
}

/** E42: what the client may do to their own published site ("Gerenciar o site"). */
export type TakedownAction = "offline" | "online" | "schedule" | "cancel";

const takedownPaths: Record<TakedownAction, string> = {
  offline: "offline",
  online: "online",
  schedule: "deletion",
  cancel: "deletion/cancel",
};

export async function manageSite(
  siteId: string,
  action: TakedownAction,
  address?: string,
): Promise<{ status: string; deleteAfter: string | null }> {
  const response = await fetch(`/api/sites/${siteId}/${takedownPaths[action]}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(address === undefined ? { confirm: true } : { confirm: true, address }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    status?: string;
    deleteAfter?: string | null;
    error?: string;
  };
  if (!response.ok) {
    throw new SiteActionError(body.error ?? "Não foi possível fazer isso agora. Tente de novo.");
  }
  return { status: body.status ?? "", deleteAfter: body.deleteAfter ?? null };
}

export async function chooseDirection(
  supabase: SupabaseClient,
  siteId: string,
  directionId: string,
) {
  await startJob(
    await rpc(supabase, "choose_direction", { p_site_id: siteId, p_direction_id: directionId }),
  );
}

export async function requestRebuild(supabase: SupabaseClient, siteId: string) {
  await startJob(await rpc(supabase, "request_rebuild", { p_site_id: siteId }));
}

/** Signed addresses of the direction screenshots (private bucket), from the platform. */
export async function renderUrls(siteId: string): Promise<Record<string, string>> {
  const response = await fetch(`/api/sites/${siteId}/renders`);
  if (!response.ok) return {};
  return (await response.json()) as Record<string, string>;
}

/** The private address of the finished site (previa.<domain>/<site>/<token>/). */
export function previewUrl(site: Pick<SiteRow, "id" | "preview_token">): string | null {
  if (!site.preview_token) return null;
  return `${hosts.previewOrigin}/${site.id}/${site.preview_token}/`;
}

/**
 * Approves the finished site. Publishing needs the one-time payment (docs/product.md): the
 * answer is the payment to complete, or `published` when it was already paid.
 */
export async function approveSite(
  siteId: string,
): Promise<{ paymentId?: string; published?: boolean }> {
  const response = await fetch(`/api/sites/${siteId}/approve`, { method: "POST" });
  const body = (await response.json().catch(() => ({}))) as {
    paymentId?: string;
    published?: boolean;
    error?: string;
  };
  if (!response.ok) {
    throw new SiteActionError(
      body.error ?? "Não foi possível aprovar agora. Tente de novo em instantes.",
    );
  }
  return body;
}

/** One direction of the site (the approved one, for its palette). */
export async function loadDirection(
  supabase: SupabaseClient,
  directionId: string,
): Promise<DirectionRow | null> {
  const { data, error } = await supabase
    .from("site_directions")
    .select("id, round, direction, identity, source, screenshots")
    .eq("id", directionId)
    .maybeSingle();
  if (error) throw error;
  return (data as DirectionRow | null) ?? null;
}
