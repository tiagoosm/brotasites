// Photos for the client's site. The browser shrinks each photo to WebP before uploading
// (phones take 4000px photos; sites never need more than 2000px); uploads.ts sends it to the
// private "site-uploads" bucket under "<user id>/<site id>/".

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
