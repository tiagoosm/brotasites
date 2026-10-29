"use client";

import { type FormStepSlug12, formSteps12 } from "@brotasites/schema/v1.2";
import { Check, CloudOff, LoaderCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useForm12 } from "@/lib/form-store";
import { SproutProgress, SproutProgressBar } from "./sprout-progress";

// Herbarium layout, under the site's one header. Desktop: steps rail | form on the "table".
// Phones: the form fills the screen. There is no live preview (decision of 2026-10-27): the client sees the 3 directions
// and the finished site on the dashboard.

export function WizardShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ etapa?: string }>();
  const step = (formSteps12.find((s) => s.slug === params.etapa)?.slug ??
    "negocio") as FormStepSlug12;

  return (
    <div
      data-wizard
      className="grid min-h-[calc(100dvh-4rem)] bg-table xl:grid-cols-[15rem_minmax(0,1fr)]"
    >
      <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] flex-col gap-12 border-r border-border bg-paper px-7 py-8 xl:flex">
        <SproutProgress current={step} />
        <div className="mt-auto grid gap-4">
          <SaveStatus />
        </div>
      </aside>

      <main className="mx-auto flex w-full max-w-[44rem] min-w-0 flex-col bg-card xl:my-6 xl:rounded-2xl xl:border xl:border-border">
        {/* The form's progress, right under the site's header (E17): no second brand or menu. */}
        <header className="sticky top-16 z-20 grid gap-3 border-b border-border bg-card/95 px-5 pt-4 pb-3 backdrop-blur sm:px-8 xl:hidden">
          <div className="flex items-center justify-end">
            <SaveStatus compact />
          </div>
          <SproutProgressBar current={step} />
        </header>
        <div key={step} className="step-enter flex flex-1 flex-col px-5 pt-8 sm:px-10 sm:pt-11">
          {children}
        </div>
      </main>
    </div>
  );
}

/** Tells the truth about the autosave: saved in the account, or not. */
function SaveStatus({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { saveState } = useForm12();
  const states = {
    idle: { icon: Check, text: compact ? "Salvo" : "Respostas salvas na sua conta" },
    saved: { icon: Check, text: compact ? "Salvo" : "Respostas salvas na sua conta" },
    saving: { icon: LoaderCircle, text: "Salvando…" },
    failed: {
      icon: CloudOff,
      text: compact ? "Só no aparelho" : "Salvo neste aparelho, mas não na sua conta",
    },
  } as const;
  const { icon: Icon, text } = states[saveState];
  const problem = saveState === "failed";
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
