"use client";

import { type FormStepSlug12, formSteps12 } from "@brotasites/schema/v1.2";
import { Check, CloudOff, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Brand } from "@/components/brand";
import { useForm12 } from "@/lib/form-store";
import { SproutProgress, SproutProgressBar } from "./sprout-progress";

// Herbarium layout. Desktop: steps rail | form on the "table". Phones: the form fills the
// screen. There is no live preview (decision of 2026-10-27): the client sees the 3 directions
// and the finished site on "Meus sites".

export function WizardShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ etapa?: string }>();
  const step = (formSteps12.find((s) => s.slug === params.etapa)?.slug ??
    "negocio") as FormStepSlug12;

  return (
    <div data-wizard className="grid min-h-dvh bg-table xl:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-12 border-r border-border bg-paper px-7 py-8 xl:flex">
        <Brand />
        <SproutProgress current={step} />
        <div className="mt-auto grid gap-4">
          <AccountArea />
          <SaveStatus />
        </div>
      </aside>

      <main className="mx-auto flex w-full max-w-[44rem] min-w-0 flex-col bg-card xl:my-6 xl:rounded-2xl xl:border xl:border-border">
        <header className="sticky top-0 z-20 grid gap-3 border-b border-border bg-card/95 px-5 pt-4 pb-3 backdrop-blur sm:px-8 xl:hidden">
          <div className="flex items-center justify-between">
            <Brand />
            <div className="flex items-center gap-4">
              <SaveStatus compact />
              <AccountArea compact />
            </div>
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

/** Who is signed in, the way to their sites and out. */
function AccountArea({ compact = false }: { compact?: boolean }) {
  const { account } = useForm12();
  return (
    <div className="grid gap-1 text-[0.8125rem] text-ink-soft">
      {!compact && <span className="truncate">{account.email}</span>}
      <div className="flex items-center gap-4">
        <Link
          href="/meus-sites"
          className="touch-target font-semibold text-leaf-deep underline-offset-4 hover:underline"
        >
          Meus sites
        </Link>
        <Link
          href="/conta"
          className="touch-target font-semibold text-leaf-deep underline-offset-4 hover:underline"
        >
          Conta
        </Link>
        {!compact && (
          <form action="/auth/sair" method="post">
            <input type="hidden" name="voltar" value="/" />
            <button
              type="submit"
              className="touch-target font-semibold text-leaf-deep underline-offset-4 hover:underline"
            >
              Sair
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
