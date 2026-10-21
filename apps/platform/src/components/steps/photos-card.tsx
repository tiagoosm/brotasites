"use client";

import {
  draftSections,
  type SectionId,
  type SiteDraft,
  setSectionContent,
} from "@brotasites/schema";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDraft } from "@/lib/draft-store";
import { deletePhoto, PhotoError, uploadPhoto } from "@/lib/photos";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { supabaseEnv } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { SectionCard } from "./fields";

// Photos for the top, the about section and the gallery. Uploading needs an account,
// since the photos are stored with the person's site.

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const GALLERY_MAX = 12;

function contentOf(draft: SiteDraft, id: SectionId): Record<string, unknown> {
  return draftSections(draft).find((section) => section.id === id)?.content ?? {};
}
const galleryOf = (draft: SiteDraft) => {
  const images = contentOf(draft, "galeria").images;
  return Array.isArray(images) ? (images as string[]) : [];
};

export function PhotosCard() {
  const { draft, account, updateDraft, ensureSite } = useDraft();
  const sections = draftSections(draft);
  const enabled = (id: SectionId) => sections.some((s) => s.id === id && s.enabled);
  const note = "Use fotos suas ou que você tem permissão para usar.";

  if (!supabaseEnv()) {
    return (
      <SectionCard name="Fotos" note="O envio de fotos não está disponível agora.">
        {null}
      </SectionCard>
    );
  }
  if (account.status === "unknown") return null;
  if (account.status === "signed-out") {
    return (
      <SectionCard name="Fotos" note={note}>
        <div className="grid gap-3 rounded-lg border border-dashed border-line-strong bg-paper p-5">
          <p className="text-[0.9375rem]">
            Para enviar fotos, entre com o seu e-mail. Elas ficam guardadas junto com o seu site.
          </p>
          <Link
            href={`/entrar?voltar=${encodeURIComponent("/criar/contato")}`}
            className="justify-self-start font-semibold text-leaf-deep underline-offset-4 hover:underline"
          >
            Entrar para enviar fotos
          </Link>
        </div>
      </SectionCard>
    );
  }

  async function upload(file: File): Promise<string> {
    const supabase = getBrowserSupabase();
    const owner = await ensureSite().catch(() => null);
    if (!supabase || !owner) throw new PhotoError("Não foi possível enviar a foto. Tente de novo.");
    return uploadPhoto(supabase, owner, file);
  }
  function discard(url: string | undefined) {
    const supabase = getBrowserSupabase();
    if (supabase && url) void deletePhoto(supabase, url).catch(() => {});
  }
  const single = (id: "hero" | "sobre") => ({
    url: contentOf(draft, id).image as string | undefined,
    onUploaded: (url: string) => {
      discard(contentOf(draft, id).image as string | undefined);
      updateDraft((d) => setSectionContent(d, id, { image: url }));
    },
    onRemove: () => {
      discard(contentOf(draft, id).image as string | undefined);
      updateDraft((d) => setSectionContent(d, id, { image: null }));
    },
  });

  return (
    <SectionCard name="Fotos" note={note}>
      <SinglePhoto label="Foto do topo" upload={upload} {...single("hero")} />
      {enabled("sobre") && (
        <SinglePhoto label="Foto da seção Sobre" upload={upload} {...single("sobre")} />
      )}
      {enabled("galeria") && (
        <Gallery
          images={galleryOf(draft)}
          upload={upload}
          onAdd={(url) =>
            updateDraft((d) => setSectionContent(d, "galeria", { images: [...galleryOf(d), url] }))
          }
          onRemove={(url) => {
            discard(url);
            updateDraft((d) =>
              setSectionContent(d, "galeria", { images: galleryOf(d).filter((u) => u !== url) }),
            );
          }}
        />
      )}
    </SectionCard>
  );
}

function useUploads(upload: (file: File) => Promise<string>) {
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  async function run(files: File[], onUploaded: (url: string) => void) {
    setError(null);
    setBusy(files.length);
    for (const file of files) {
      try {
        onUploaded(await upload(file));
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
  return { busy, error, run };
}

function PickButton({
  label,
  multiple = false,
  busy,
  onFiles,
  className,
  children,
}: {
  label: string;
  multiple?: boolean;
  busy: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf",
        busy && "pointer-events-none opacity-70",
        className,
      )}
    >
      <input
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        aria-label={label}
        disabled={busy}
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      {children}
    </label>
  );
}

function Uploading() {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-soft" role="status">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-leaf" />
      Enviando…
    </span>
  );
}

function SinglePhoto({
  label,
  url,
  upload,
  onUploaded,
  onRemove,
}: {
  label: string;
  url: string | undefined;
  upload: (file: File) => Promise<string>;
  onUploaded: (url: string) => void;
  onRemove: () => void;
}) {
  const { busy, error, run } = useUploads(upload);
  return (
    <div className="grid gap-2.5">
      <p className="text-[0.9375rem] font-semibold">{label}</p>
      {url ? (
        <div className="grid grid-cols-[7rem_1fr] items-center gap-4">
          {/* biome-ignore lint/performance/noImgElement: uploaded photo thumbnail, already resized */}
          <img src={url} alt={label} className="aspect-[4/3] w-28 rounded-lg object-cover" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.9375rem]">
            {busy ? (
              <Uploading />
            ) : (
              <>
                <PickButton
                  label={`Trocar ${label.toLocaleLowerCase("pt-BR")}`}
                  busy={false}
                  onFiles={(files) => run(files.slice(0, 1), onUploaded)}
                  className="font-semibold text-leaf-deep underline-offset-4 hover:underline"
                >
                  Trocar
                </PickButton>
                <button
                  type="button"
                  onClick={onRemove}
                  className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                >
                  Remover
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <PickButton
          label={label}
          busy={busy > 0}
          onFiles={(files) => run(files.slice(0, 1), onUploaded)}
          className="flex h-24 items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-paper text-[0.9375rem] font-semibold text-leaf-deep transition-colors duration-150 hover:border-leaf hover:bg-leaf-wash/50"
        >
          {busy ? (
            <Uploading />
          ) : (
            <>
              <ImagePlus aria-hidden="true" className="size-5" />
              Escolher foto
            </>
          )}
        </PickButton>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Gallery({
  images,
  upload,
  onAdd,
  onRemove,
}: {
  images: string[];
  upload: (file: File) => Promise<string>;
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
}) {
  const { busy, error, run } = useUploads(upload);
  const room = GALLERY_MAX - images.length - busy;
  return (
    <div className="grid gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.9375rem] font-semibold">Galeria</p>
        <span className="tag text-ink-soft">
          {images.length}/{GALLERY_MAX}
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-2.5" aria-label="Fotos da galeria">
        {images.map((url, index) => (
          <li key={url} className="relative">
            {/* biome-ignore lint/performance/noImgElement: uploaded photo thumbnail, already resized */}
            <img
              src={url}
              alt={`Foto ${index + 1} da galeria`}
              className="aspect-square w-full rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(url)}
              aria-label={`Remover foto ${index + 1} da galeria`}
              className="absolute top-1.5 right-1.5 inline-flex size-8 items-center justify-center rounded-full bg-ink/75 text-white backdrop-blur transition-colors duration-150 hover:bg-ink"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
        {Array.from({ length: busy }, (_, index) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
            key={`enviando-${index}`}
            className="flex aspect-square items-center justify-center rounded-lg bg-table"
          >
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-leaf" />
          </li>
        ))}
        {room > 0 && (
          <li>
            <PickButton
              label="Adicionar fotos à galeria"
              multiple
              busy={false}
              onFiles={(files) => run(files.slice(0, room), onAdd)}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong bg-paper text-sm font-semibold text-leaf-deep transition-colors duration-150 hover:border-leaf hover:bg-leaf-wash/50"
            >
              <ImagePlus aria-hidden="true" className="size-5" />
              Adicionar
            </PickButton>
          </li>
        )}
      </ul>
      {busy > 0 && <Uploading />}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
