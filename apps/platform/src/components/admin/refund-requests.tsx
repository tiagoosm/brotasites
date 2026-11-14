"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/config/pricing";
import { adminPost } from "@/lib/admin/client";

// "Desistência" (E43), on a site's page in the team panel. The client withdrew within 7 days of
// paying (direito de arrependimento); the team refunds at the payment provider at once (Decreto
// 7.962/2013 art. 5, §3: tell the bank or card company so the charge is not billed or is
// refunded) and records it here, which marks the charge refunded and tells the client.

export interface RefundRow {
  id: string;
  amount_cents: number;
  status: "requested" | "refunded";
  requested_at: string;
  resolved_at: string | null;
  note: string | null;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

const money = (cents: number) => formatBRL(Math.round(cents) / 100);

export function RefundRequests({
  siteId,
  refunds,
  onDone,
}: {
  siteId: string;
  refunds: RefundRow[];
  onDone: () => Promise<unknown>;
}) {
  const noteId = useId();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (refunds.length === 0) return null;
  const pending = refunds.some((row) => row.status === "requested");

  async function confirm(requestId: string) {
    setBusy(true);
    setMessage(null);
    try {
      await adminPost(`/api/admin/sites/${siteId}/decide`, {
        action: "refund_done",
        requestId,
        note: note.trim(),
      });
      setOpen(null);
      setNote("");
      await onDone();
      setMessage("Devolução registrada. O cliente foi avisado.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Não foi possível salvar.");
    }
    setBusy(false);
  }

  return (
    <section
      aria-labelledby="desistencia"
      className={`grid gap-4 rounded-xl border bg-card p-5 ${pending ? "border-destructive/40" : "border-input"}`}
    >
      <h2 id="desistencia" className="font-display text-[1.5rem]">
        Desistência
      </h2>
      {pending && (
        <p className="text-[0.9375rem]">
          O cliente desistiu dentro dos 7 dias (direito de arrependimento). Devolva o valor integral
          no provedor de pagamento <strong>agora</strong> (estorno no cartão ou devolução do Pix) e
          registre aqui.
        </p>
      )}
      <ul className="grid gap-3">
        {refunds.map((row) => (
          <li key={row.id} className="grid gap-2 rounded-lg border border-line p-4">
            <p className="text-[0.9375rem]">
              <span className="font-semibold">{money(row.amount_cents)}</span> · pedido em{" "}
              {when(row.requested_at)} ·{" "}
              {row.status === "refunded"
                ? `devolvido em ${row.resolved_at ? when(row.resolved_at) : "–"}`
                : "a devolver"}
              {row.note ? ` · ${row.note}` : ""}
            </p>
            {row.status === "requested" &&
              (open === row.id ? (
                <div className="grid gap-3">
                  <label htmlFor={noteId} className="text-[0.9375rem] font-semibold">
                    Nota (opcional: id do estorno no provedor)
                  </label>
                  <textarea
                    id={noteId}
                    value={note}
                    maxLength={1000}
                    rows={2}
                    onChange={(event) => setNote(event.target.value)}
                    className="rounded-lg border border-input bg-card p-3 text-base"
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      size="lg"
                      className="h-auto min-h-12 py-3 text-center whitespace-normal"
                      aria-busy={busy || undefined}
                      disabled={busy}
                      onClick={() => void confirm(row.id)}
                    >
                      {busy ? "Salvando…" : "Confirmar: valor devolvido"}
                    </Button>
                    <Button variant="ghost" size="lg" disabled={busy} onClick={() => setOpen(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-auto min-h-12 justify-self-start py-3 text-center whitespace-normal"
                  onClick={() => {
                    setMessage(null);
                    setOpen(row.id);
                  }}
                >
                  Marcar como devolvido
                </Button>
              ))}
          </li>
        ))}
      </ul>
      <p role="status" className="text-[0.9375rem] font-semibold empty:hidden">
        {message}
      </p>
    </section>
  );
}
