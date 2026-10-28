"use client";

import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm12 } from "@/lib/form-store";
import { PhotoError } from "@/lib/photos";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { assetUrls, removeAsset, uploadAsset } from "@/lib/uploads";
import { cn } from "@/lib/utils";

// Uploads for the form: the logo (step 2) and the photos (step 4). Files go to the person's
// private folder; the generation job cleans them before any site uses them.

export function useAssetUrls(assetIds: (string | null | undefined)[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = assetIds.filter(Boolean).sort().join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the ids
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const missing = key.split(",").filter((id) => id && !urls[id]);
    if (!supabase || missing.length === 0) return;
    assetUrls(supabase, missing).then((found) => setUrls((current) => ({ ...current, ...found })));
  }, [key]);
  return [
    urls,
    (id: string, url: string) => setUrls((current) => ({ ...current, [id]: url })),
  ] as const;
}

export function useUploader(kind: "image" | "logo") {
  const { siteId, account } = useForm12();
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  async function upload(files: File[], onDone: (assetId: string, previewUrl: string) => void) {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setError(null);
    setBusy(files.length);
    for (const file of files) {
      try {
        const uploaded = await uploadAsset(
          supabase,
          { userId: account.userId, siteId },
          file,
          kind,
        );
        onDone(uploaded.assetId, uploaded.previewUrl);
      } catch (caught) {
        setError(
          caught instanceof PhotoError
            ? caught.message
            : "Não foi possível enviar a foto. Tente de novo.",
        );
      }
      setBusy((n) => n - 1);
    }
  }
  function discard(assetId: string | null | undefined) {
    const supabase = getBrowserSupabase();
    if (supabase && assetId) void removeAsset(supabase, assetId).catch(() => {});
  }
  return { busy, error, upload, discard };
}

export function PickFiles({
  label,
  multiple = false,
  disabled,
  onFiles,
}: {
  label: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong px-4 text-[0.9375rem] font-semibold text-leaf-deep transition-colors duration-150 hover:border-leaf hover:bg-leaf-wash/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      <ImagePlus aria-hidden="true" className="size-4" />
      {label}
    </label>
  );
}

export function UploadStatus({ busy, error }: { busy: number; error: string | null }) {
  return (
    <div role="status" className="text-sm empty:hidden">
      {busy > 0 && (
        <span className="inline-flex items-center gap-2 text-ink-soft">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Enviando {busy > 1 ? `${busy} fotos` : "a foto"}…
        </span>
      )}
      {error && <span className="font-semibold text-destructive">{error}</span>}
    </div>
  );
}

export function Thumb({
  url,
  alt,
  onRemove,
  removeLabel,
}: {
  url?: string;
  alt: string;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="relative size-24 overflow-hidden rounded-lg border border-border bg-table">
      {url ? (
        // biome-ignore lint/performance/noImgElement: a signed address of the person's own file
        <img src={url} alt={alt} className="size-full object-cover" />
      ) : (
        <span className="sr-only">{alt}</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-full bg-card/90 text-ink shadow-sm"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
