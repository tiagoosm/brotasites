import { isReservedSubdomain, subdomainSchema, suggestSubdomain } from "@brotasites/schema";
import type { SupabaseClient } from "@supabase/supabase-js";

// The address question (step 7): format, reserved names and availability
// (subdomain_available in supabase/migrations/20261021190000_publication_private.sql).

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

export class AddressError extends Error {}

/**
 * Keeps the address for the site. Owners may write only this column of their sites (RLS and
 * column grants); the unique index refuses an address someone else already has.
 */
export async function reserveSubdomain(
  supabase: SupabaseClient,
  siteId: string,
  subdomain: string,
): Promise<void> {
  const { error } = await supabase.from("sites").update({ subdomain }).eq("id", siteId);
  if (!error) return;
  throw new AddressError(
    error.code === "23505"
      ? "Alguém acabou de escolher esse endereço. Escolha outro."
      : error.code === "23514"
        ? "Esse endereço não pode ser usado. Escolha outro."
        : "Não foi possível guardar o endereço agora. Tente de novo em instantes.",
  );
}
