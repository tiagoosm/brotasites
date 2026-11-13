"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminPost } from "@/lib/admin/client";

// One team action of the panel (E24): it asks for the reason (logged with who, when, before and
// after) and a second, deliberate click before acting (Murphy).

type Target = { siteId: string } | { userId: string };

export function TeamAction({
  action,
  target,
  label,
  confirmLabel,
  days,
  onDone,
}: {
  action: "grant_round" | "grant_site_slot" | "extend_cleanup";
  target: Target;
  label: string;
  confirmLabel: string;
  days?: number;
  onDone?: () => void;
}) {
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setMessage(null);
    try {
      await adminPost("/api/admin/limits", {
        action,
        ...target,
        ...(days ? { days } : {}),
        note: note.trim(),
      });
      setMessage("Feito. A ação foi registrada no log.");
      setOpen(false);
      setNote("");
      onDone?.();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Não foi possível salvar.");
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-3">
      {open ? (
        <div className="grid gap-3">
          <label htmlFor={noteId} className="text-[0.9375rem] font-semibold">
            Motivo (fica no log)
          </label>
          <textarea
            id={noteId}
            value={note}
            maxLength={500}
            rows={2}
            onChange={(event) => setNote(event.target.value)}
            className="rounded-lg border border-input bg-card p-3 text-base"
          />
          <p id={`${noteId}-why`} className="text-sm text-ink-soft">
            Escreva o motivo, com 3 letras ou mais, para confirmar.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              disabled={busy || note.trim().length < 3}
              aria-describedby={`${noteId}-why`}
              className="h-auto min-h-12 py-3 text-center whitespace-normal"
              onClick={confirm}
            >
              {confirmLabel}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="lg"
          // Wraps on phones: long labels were wider than a 375px screen.
          className="h-auto min-h-12 justify-self-start py-3 text-center whitespace-normal"
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
      )}
      {message && (
        <p role="status" className="text-[0.9375rem] font-semibold">
          {message}
        </p>
      )}
    </div>
  );
}
