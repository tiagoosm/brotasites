"use client";

import { type FormStepSlug, formSteps } from "@brotasites/schema";
import { Check, CloudOff, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useDraft } from "@/lib/draft-store";
import { supabaseEnv } from "@/lib/supabase/env";
import { PreviewPanel } from "./preview-panel";
import { SproutProgress, SproutProgressBar } from "./sprout-progress";

// Herbarium layout. Desktop: steps rail | form | live preview on the "table".
// Phones: the form fills the screen; the preview opens over it from the step footer.

const PreviewToggle = createContext<() => void>(() => {});
export const useOpenPreview = () => useContext(PreviewToggle);

export function WizardShell({ children }: { children: React.ReactNode }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  // Mount the live preview only where it shows: side panel on wide screens, dialog on phones.
  const wide = useMediaQuery("(min-width: 1024px)");
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
          <div className="mt-auto grid gap-4">
            <AccountArea step={step} />
            <SaveStatus />
          </div>
        </aside>

        <main className="flex min-w-0 flex-col bg-card lg:border-r lg:border-border">
          <header className="sticky top-0 z-20 grid gap-3 border-b border-border bg-card/95 px-5 pt-4 pb-3 backdrop-blur sm:px-8 xl:hidden">
            <div className="flex items-center justify-between">
              <Brand />
              <div className="flex items-center gap-4">
                <SaveStatus compact />
                <AccountArea step={step} compact />
              </div>
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
          {wide && <PreviewPanel />}
        </section>

        {previewOpen && !wide && (
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

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Tells the truth about the autosave: where it is saved, or that it is not. */
function SaveStatus({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { saveState, account } = useDraft();
  const where = account.status === "signed-in" ? "na sua conta" : "neste aparelho";
  const states = {
    idle: { icon: Check, text: compact ? "Salvo" : `Rascunho salvo ${where}` },
    saved: { icon: Check, text: compact ? "Salvo" : `Rascunho salvo ${where}` },
    saving: { icon: LoaderCircle, text: "Salvando…" },
    failed: {
      icon: CloudOff,
      text: compact ? "Não salvo" : "Não foi possível salvar neste aparelho",
    },
    "account-failed": {
      icon: CloudOff,
      text: compact ? "Só no aparelho" : "Salvo neste aparelho, mas não na sua conta",
    },
  } as const;
  const { icon: Icon, text } = states[saveState];
  const problem = saveState === "failed" || saveState === "account-failed";
  return (
    <p
      role="status"
      className={`flex items-center gap-2 text-[0.8125rem] text-ink-soft ${className ?? ""}`}
    >
      <Icon
        aria-hidden="true"
        className={`size-4 shrink-0 ${problem ? "text-destructive" : "text-leaf"} ${saveState === "saving" ? "animate-spin" : ""}`}
      />
      {text}
    </p>
  );
}

/** Sign in to keep the draft in an account, or show who is signed in. */
function AccountArea({ step, compact = false }: { step: FormStepSlug; compact?: boolean }) {
  const { account } = useDraft();
  const here = `/criar/${step}`;
  if (!supabaseEnv() || account.status === "unknown") return null;

  if (account.status === "signed-out") {
    return (
      <Link
        href={`/entrar?voltar=${encodeURIComponent(here)}`}
        className={
          compact
            ? "touch-target text-[0.8125rem] font-semibold text-leaf-deep underline-offset-4 hover:underline"
            : "rounded-lg border border-dashed border-line-strong p-3 text-[0.8125rem] text-ink-soft transition-colors hover:border-leaf hover:text-ink"
        }
      >
        {compact ? (
          "Entrar"
        ) : (
          <>
            <span className="block font-semibold text-leaf-deep">
              Entrar para salvar na sua conta
            </span>
            Assim você continua de qualquer aparelho.
          </>
        )}
      </Link>
    );
  }

  return (
    <form action="/auth/sair" method="post" className="grid gap-1 text-[0.8125rem] text-ink-soft">
      <input type="hidden" name="voltar" value={here} />
      {!compact && <span className="truncate">{account.email}</span>}
      <button
        type="submit"
        className="touch-target justify-self-start font-semibold text-leaf-deep underline-offset-4 hover:underline"
      >
        Sair
      </button>
    </form>
  );
}
