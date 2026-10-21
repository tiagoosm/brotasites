import type { SupabaseClient } from "@supabase/supabase-js";

// Photos for the client's site. The browser shrinks each photo to WebP before uploading
// (phones take 4000px photos; sites never need more than 2000px), then it goes to the
// "site-images" bucket under "<user id>/<site id>/" (see supabase/migrations).

export const PHOTO_BUCKET = "site-images";
export const MAX_SIDE = 2000;
/** Larger originals are refused before reading them, to keep phones responsive. */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
const QUALITY = 0.85;

export class PhotoError extends Error {}

/** Width and height that fit inside `max` on the longest side, keeping the proportions. */
export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function photoPath(userId: string, siteId: string, id = crypto.randomUUID()): string {
  return `${userId}/${siteId}/${id}.webp`;
}

/** The storage path inside the bucket for one of its public URLs, or null for other URLs. */
export function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${PHOTO_BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length));
}

/** Shrinks and converts a photo in the browser. Errors carry pt-BR messages. */
export async function preparePhoto(file: File) {
  if (!/^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.type)) {
    throw new PhotoError("Escolha uma foto em JPG, PNG ou WebP.");
  }
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new PhotoError("Essa foto é grande demais. Escolha uma com até 25 MB.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError("Não foi possível abrir essa foto. Tente outra, em JPG ou PNG.");
  }
  const size = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY),
  );
  if (!blob) throw new PhotoError("Não foi possível preparar essa foto. Tente outra.");
  return { blob, ...size };
}

/** Uploads a photo to the person's folder and records it. Returns its public URL. */
export async function uploadPhoto(
  supabase: SupabaseClient,
  owner: { userId: string; siteId: string },
  file: File,
): Promise<string> {
  const { blob, width, height } = await preparePhoto(file);
  const path = photoPath(owner.userId, owner.siteId);
  const upload = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
  });
  if (upload.error) throw new PhotoError("Não foi possível enviar a foto. Tente de novo.");
  // The record only helps cleanup; a failure here does not lose the photo.
  await supabase
    .from("assets")
    .insert({ site_id: owner.siteId, storage_path: path, kind: "image", width, height });
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Deletes an uploaded photo. Best effort: the draft no longer uses it either way. */
export async function deletePhoto(supabase: SupabaseClient, url: string): Promise<void> {
  const path = pathFromPublicUrl(url);
  if (!path) return;
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  await supabase.from("assets").delete().eq("storage_path", path);
}
