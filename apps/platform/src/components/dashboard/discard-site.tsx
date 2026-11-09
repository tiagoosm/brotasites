"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { discardSite, SiteActionError } from "@/lib/sites";
import { cn } from "@/lib/utils";

// Discarding an unpaid site: final, so it takes a second, deliberate click (Murphy), away from
// the main actions (Fitts). On the site's page it is a section at the end; on the dashboard's
// card, a quiet button after the others. Either way the account's slot for a new site is freed.

export function DiscardSite({
  siteId,
  siteName,
  busy = false,
  working = false,
  compact = false,
  onDone,
}: {
  siteId: string;
  siteName: string;
  /** Another action is running on the page. */
  busy?: boolean;
  /** We are working on the site right now (directions, building, review). */
  working?: boolean;
  /** The dashboard card's version: no heading, the confirmation inline. */
  compact?: boolean;
  /** After discarding; by default, back to the dashboard. */
  onDone?: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function discard() {
    setPending(true);
    setError(null);
    try {
      await discardSite(siteId);
      if (onDone) onDone();
      else {
        router.push("/meus-sites");
        router.refresh();
      }
    } catch (caught) {
      setError(
        caught instanceof SiteActionError
          ? caught.message
          : "Não foi possível descartar agora. Tente de novo.",
      );
      setPending(false);
    }
  }

  const question = (
    <p className="text-[0.9375rem]">
      Apagar {compact ? <strong>{siteName}</strong> : "este site"}, as respostas e as fotos?{" "}
      {working && "O que estamos preparando para ele para na hora. "}Isso não pode ser desfeito.
    </p>
  );

  const body = confirming ? (
    <div className="grid gap-3">
      {question}
      <div className="flex flex-wrap gap-3">
        <Button
          aria-busy={pending || undefined}
          variant="destructive"
          size="lg"
          disabled={busy || pending}
          onClick={discard}
        >
          {pending ? "Descartando…" : "Sim, descartar"}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  ) : (
    <>
      {!compact && (
        <p className="text-[0.9375rem] text-ink-soft">Libera a vaga para criar outro site.</p>
      )}
      <Button
        variant={compact ? "ghost" : "outline"}
        size="lg"
        className={cn("justify-self-start text-destructive", compact && "px-3")}
        disabled={busy}
        onClick={() => setConfirming(true)}
      >
        {compact ? "Descartar" : "Descartar este site"}
        {compact && <span className="sr-only"> {siteName}</span>}
      </Button>
    </>
  );

  const alert = error && (
    <p role="alert" className="text-[0.9375rem] font-semibold text-destructive">
      {error}
    </p>
  );

  if (compact) {
    return (
      <div
        className={cn(
          "grid gap-3",
          confirming ? "basis-full border-t border-line pt-4" : "ml-auto",
        )}
      >
        {body}
        {alert}
      </div>
    );
  }
  return (
    <section aria-labelledby="descartar" className="grid gap-3 border-t border-line pt-8">
      <h2 id="descartar" className="text-[1.0625rem] font-semibold">
        Descartar este site
      </h2>
      {body}
      {alert}
    </section>
  );
}
