"use client";

import { type FormStepSlug, formSteps } from "@brotasites/schema";
import { Check, CloudOff, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDraft } from "@/lib/draft-store";
import { PreviewPanel } from "./preview-panel";
import { SproutProgress, SproutProgressBar } from "./sprout-progress";

// Herbarium layout. Desktop: steps rail | form | live preview on the "table".
// Phones: the form fills the screen; the preview opens over it from the step footer.

const PreviewToggle = createContext<() => void>(() => {});
export const useOpenPreview = () => useContext(PreviewToggle);

export function WizardShell({ children }: { children: React.ReactNode }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const params = useParams<{ etapa?: string }>();
  const step = (formSteps.find((s) => s.slug === params.etapa)?.slug ?? "negocio") as FormStepSlug;

  useEffect(() => {
    if (!previewOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setPreviewOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [previewOpen]);

  return (
    <PreviewToggle value={() => setPreviewOpen(true)}>
      <div className="grid min-h-dvh lg:grid-cols-[minmax(26rem,30rem)_1fr] xl:grid-cols-[15rem_minmax(26rem,30rem)_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-12 border-r border-border px-7 py-8 xl:flex">
          <Brand />
          <SproutProgress current={step} />
          <SaveStatus className="mt-auto" />
        </aside>

        <main className="flex min-w-0 flex-col bg-card lg:border-r lg:border-border">
          <header className="sticky top-0 z-20 grid gap-3 border-b border-border bg-card/95 px-5 pt-4 pb-3 backdrop-blur sm:px-8 xl:hidden">
            <div className="flex items-center justify-between">
              <Brand />
              <SaveStatus compact />
            </div>
            <SproutProgressBar current={step} />
          </header>
          <div key={step} className="step-enter flex flex-1 flex-col px-5 pt-8 sm:px-10 sm:pt-11">
            {children}
          </div>
        </main>

        <section
          aria-label="Prévia do site"
          className="sticky top-0 hidden h-dvh bg-table p-5 lg:block xl:p-7"
        >
          <PreviewPanel />
        </section>

        {previewOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Prévia do site"
            className="fixed inset-0 z-40 flex flex-col bg-table p-3 lg:hidden"
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="font-display text-xl">Prévia</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setPreviewOpen(false)}
                aria-label="Fechar prévia"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <PreviewPanel compact />
            </div>
          </div>
        )}
      </div>
    </PreviewToggle>
  );
}

function Brand() {
  return (
    <Link
      href="/criar/negocio"
      className="flex items-center gap-2.5 font-display text-[1.375rem] leading-none"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 text-leaf">
        <path d="M12 22V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 13C12 8 8.5 5 3 5c0 5.5 3.5 8 9 8Z" fill="currentColor" />
        <path d="M12 11c0-4.5 3-7.5 9-7.5 0 5-3 7.5-9 7.5Z" fill="currentColor" opacity=".65" />
      </svg>
      BrotaSites
    </Link>
  );
}

/** Tells the truth about the autosave: saving, saved on this device, or not saved. */
function SaveStatus({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { saveState } = useDraft();
  const states = {
    idle: { icon: Check, text: compact ? "Salvo" : "Rascunho salvo neste aparelho" },
    saved: { icon: Check, text: compact ? "Salvo" : "Rascunho salvo neste aparelho" },
    saving: { icon: LoaderCircle, text: "Salvando…" },
    failed: {
      icon: CloudOff,
      text: compact ? "Não salvo" : "Não foi possível salvar neste aparelho",
    },
  } as const;
  const { icon: Icon, text } = states[saveState];
  return (
    <p
      role="status"
      className={`flex items-center gap-2 text-[0.8125rem] text-ink-soft ${className ?? ""}`}
    >
      <Icon
        aria-hidden="true"
        className={`size-4 ${saveState === "failed" ? "text-destructive" : "text-leaf"} ${saveState === "saving" ? "animate-spin" : ""}`}
      />
      {text}
    </p>
  );
}
