import type { SupabaseClient } from "@supabase/supabase-js";
import { PhotoError, photoPath, preparePhoto } from "./photos";

// Photos and logos for 1.2 sites go to the private "site-uploads" bucket, under the person's
// folder. The generation job cleans each one (docs/security.md) and publishes only the clean
// copy. The draft refers to them by asset id.

export const UPLOAD_BUCKET = "site-uploads";

export interface UploadedAsset {
  assetId: string;
  /** A local address to show the photo right away. */
  previewUrl: string;
}

export async function uploadAsset(
  supabase: SupabaseClient,
  owner: { userId: string; siteId: string },
  file: File,
  kind: "image" | "logo",
): Promise<UploadedAsset> {
  const { blob, width, height } = await preparePhoto(file);
  const path = photoPath(owner.userId, owner.siteId);
  const upload = await supabase.storage
    .from(UPLOAD_BUCKET)
    .upload(path, blob, { contentType: "image/webp" });
  if (upload.error) throw new PhotoError("Não foi possível enviar a foto. Tente de novo.");
  const { data, error } = await supabase
    .from("assets")
    .insert({
      site_id: owner.siteId,
      storage_path: path,
      kind,
      width,
      height,
      bucket: UPLOAD_BUCKET,
    })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from(UPLOAD_BUCKET).remove([path]);
    throw new PhotoError("Não foi possível guardar a foto. Tente de novo.");
  }
  return { assetId: data.id as string, previewUrl: URL.createObjectURL(blob) };
}

export async function removeAsset(supabase: SupabaseClient, assetId: string): Promise<void> {
  const { data } = await supabase
    .from("assets")
    .select("storage_path, bucket")
    .eq("id", assetId)
    .maybeSingle();
  if (!data) return;
  await supabase.storage.from(data.bucket as string).remove([data.storage_path as string]);
  await supabase.from("assets").delete().eq("id", assetId);
}

/** Short-lived addresses for showing the person's own photos in the form. */
export async function assetUrls(
  supabase: SupabaseClient,
  assetIds: string[],
): Promise<Record<string, string>> {
  if (assetIds.length === 0) return {};
  const { data } = await supabase
    .from("assets")
    .select("id, storage_path, bucket")
    .in("id", assetIds);
  const urls: Record<string, string> = {};
  for (const row of data ?? []) {
    const signed = await supabase.storage
      .from(row.bucket as string)
      .createSignedUrl(row.storage_path as string, 3600);
    if (signed.data?.signedUrl) urls[row.id as string] = signed.data.signedUrl;
  }
  return urls;
}
