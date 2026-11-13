"use client";

import {
  isEmptyFeedback,
  REDO_NOTE_MAX,
  type RedoFeedback,
  type RedoReason,
  redoOpposites,
  redoReasonLabels,
  redoReasons,
} from "@brotasites/schema/v1.2";
import { Check } from "lucide-react";
import { useId, useState } from "react";
import { chipClass } from "@/components/shared/chip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// "O que você não gostou?" (E41): before a new round is spent, the client may say what to
// change. Every chip is optional, and so is the note; "Criar sem dizer o motivo" skips it all.
// Opposite chips replace each other (lighter or darker), so the engine never gets both.

export function RedoPanel({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (feedback: RedoFeedback | undefined) => void;
}) {
  const titleId = useId();
  const noteId = useId();
  const [reasons, setReasons] = useState<RedoReason[]>([]);
  const [note, setNote] = useState("");

  function toggle(reason: RedoReason) {
    setReasons((current) => {
      if (current.includes(reason)) return current.filter((item) => item !== reason);
      const opposite = redoOpposites.find((pair) => pair.includes(reason));
      const other = opposite?.find((item) => item !== reason);
      return [...current.filter((item) => item !== other), reason];
    });
  }

  const feedback: RedoFeedback = {
    reasons: redoReasons.filter((reason) => reasons.includes(reason)),
    ...(note.trim() ? { note: note.trim() } : {}),
  };

  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="grid gap-1">
        <h3 id={titleId} className="text-[1.0625rem] font-semibold">
          O que você não gostou?
        </h3>
        <p className="text-sm text-ink-soft">
          Opcional. Marque o que quiser mudar e as próximas 3 seguem por esse caminho.
        </p>
      </div>
      <fieldset className="grid gap-2">
        <legend className="sr-only">O que mudar nas próximas direções</legend>
        <div className="flex flex-wrap gap-2">
          {redoReasons.map((reason) => {
            const on = reasons.includes(reason);
            return (
              <button
                key={reason}
                type="button"
                aria-pressed={on}
                disabled={busy}
                onClick={() => toggle(reason)}
                className={cn(
                  chipClass({ checked: on }),
                  "touch-target cursor-pointer gap-1.5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf motion-reduce:active:scale-100",
                )}
              >
                {on && <Check aria-hidden="true" className="size-4" />}
                {redoReasonLabels[reason]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <label htmlFor={noteId} className="text-sm font-semibold">
          Quer contar mais? (opcional)
        </label>
        <input
          id={noteId}
          type="text"
          value={note}
          maxLength={REDO_NOTE_MAX}
          disabled={busy}
          placeholder="Ex.: queria algo mais alegre, com cara de festa."
          onChange={(event) => setNote(event.target.value)}
          aria-describedby={`${noteId}-count`}
          className="h-12 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base text-ink outline-none focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/15"
        />
        <p id={`${noteId}-count`} className="text-right text-[0.8125rem] text-ink-soft">
          {note.length}/{REDO_NOTE_MAX}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button
          type="button"
          size="lg"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => onSubmit(isEmptyFeedback(feedback) ? undefined : feedback)}
        >
          {busy ? "Pedindo…" : "Criar outras 3"}
        </Button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSubmit(undefined)}
          className="touch-target text-sm font-semibold text-leaf-deep underline underline-offset-4 disabled:opacity-60"
        >
          Criar sem dizer o motivo
        </button>
      </div>
    </section>
  );
}
