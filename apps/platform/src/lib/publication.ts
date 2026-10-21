import { isReservedSubdomain, subdomainSchema, suggestSubdomain } from "@brotasites/schema";
import type { SupabaseClient } from "@supabase/supabase-js";

// The address question and the publish button talk to the database functions in
// supabase/migrations/20261021180000_publication.sql.

export type Availability =
  | { state: "checking" }
  | { state: "available" }
  | { state: "invalid"; message: string }
  | { state: "taken"; suggestion?: string }
  | { state: "unknown" };

/** Turns what was typed into a usable address as the person types ("Zé Doces" → "ze-doces"). */
export function tidySubdomain(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_.]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 40);
}

/** Problems that need no database: format and reserved addresses. */
export function localSubdomainProblem(subdomain: string): string | null {
  const format = subdomainSchema.safeParse(subdomain);
  if (!format.success) return format.error.issues[0]?.message ?? "Endereço inválido.";
  if (isReservedSubdomain(subdomain)) return "Esse endereço é reservado. Escolha outro.";
  return null;
}

/** Another address to offer when one is taken: the name plus the city. */
export function alternativeSubdomain(subdomain: string, city: string | undefined) {
  const withCity = suggestSubdomain(`${subdomain} ${city ?? ""}`);
  return withCity && withCity !== subdomain ? withCity : undefined;
}

export async function checkSubdomain(
  supabase: SupabaseClient,
  subdomain: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("subdomain_available", { p_subdomain: subdomain });
  if (error) throw error;
  return data === true;
}

const publishErrors: Record<string, string> = {
  subdomain_taken: "Alguém acabou de escolher esse endereço. Escolha outro.",
  subdomain_invalid: "Esse endereço não pode ser usado. Escolha outro.",
  already_running: "O seu site já está sendo gerado. Acompanhe na próxima tela.",
  site_not_found: "Não encontramos o seu site. Entre de novo e tente outra vez.",
};

export class PublishError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Reserves the address and queues the generation. Errors carry pt-BR messages. */
export async function requestPublication(
  supabase: SupabaseClient,
  siteId: string,
  subdomain: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("request_publication", {
    p_site_id: siteId,
    p_subdomain: subdomain,
  });
  if (error) {
    const code = Object.keys(publishErrors).find((key) => error.message?.includes(key));
    throw new PublishError(
      code
        ? (publishErrors[code] as string)
        : "Não foi possível publicar agora. Tente de novo em instantes.",
      code,
    );
  }
  return data as string;
}
