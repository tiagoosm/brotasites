"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminPost } from "@/lib/admin/client";

// "Retirada do ar" (E42), on a site's page in the team panel. The team takes a site offline with
// a reason (and may show it to the client), puts it back, schedules a deletion (0 to 30 days) or
// cancels it, and deletes now by typing the address. Every action needs a note and is logged
// (site_takedowns and admin_decisions). Suspending stays in "Decisão": it is the disciplinary
// measure; this is the neutral one.

export interface TakedownSite {
  id: string;
  status: string;
  subdomain: string | null;
  published_at?: string | null;
  offline_by?: string | null;
  offline_public_reason?: string | null;
  delete_after?: string | null;
  deletion_by?: string | null;
  deletion_attempts?: number | null;
  deletion_error?: string | null;
}

export interface TakedownRow {
  action: string;
  actor: string;
  reason: string | null;
  note: string | null;
  delete_after: string | null;
  created_at: string;
}

type Action =
  | "take_offline"
  | "restore_online"
  | "schedule_deletion"
  | "cancel_deletion"
  | "delete_now";

export const reasonLabels: Record<string, string> = {
  owner_request: "Pedido do cliente",
  admin: "Decisão da equipe",
  abuse: "Abuso ou denúncia",
  legal: "Ordem legal",
  terms: "Termos de uso",
  payment: "Pagamento",
  other: "Outro",
};
const teamReasons = ["admin", "abuse", "legal", "terms", "payment", "other"] as const;

export const takedownLabels: Record<string, string> = {
  take_offline: "Tirou do ar",
  restore_online: "Recolocou no ar",
  schedule_deletion: "Agendou a exclusão",
  cancel_deletion: "Cancelou a exclusão",
  delete: "Excluiu",
};
const actorLabels: Record<string, string> = {
  owner: "Cliente",
  admin: "Equipe",
  system: "Rotina diária",
};

const actionTitles: Record<Action, string> = {
  take_offline: "Tirar do ar",
  restore_online: "Recolocar no ar",
  schedule_deletion: "Agendar a exclusão",
  cancel_deletion: "Cancelar a exclusão",
  delete_now: "Excluir agora",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

/** Which actions fit the site now; the database checks again. */
export function takedownActionsFor(site: TakedownSite): Action[] {
  const scheduled = Boolean(site.delete_after);
  const published = Boolean(site.published_at) || ["offline", "suspended"].includes(site.status);
  if (!published) return [];
  const list: Action[] = [];
  if (["live", "grace"].includes(site.status) && !scheduled) list.push("take_offline");
  if (site.status === "offline" && !scheduled) list.push("restore_online");
  if (scheduled) list.push("cancel_deletion");
  else if (["live", "grace", "offline", "suspended"].includes(site.status)) {
    list.push("schedule_deletion");
  }
  list.push("delete_now");
  return list;
}

export function TakedownPanel({
  site,
  history,
  blockers,
  onDone,
}: {
  site: TakedownSite;
  history: TakedownRow[];
  blockers?: { job: boolean; payment: boolean };
  onDone: (message: string) => Promise<unknown>;
}) {
  const ids = {
    reason: useId(),
    note: useId(),
    days: useId(),
    address: useId(),
    show: useId(),
    why: useId(),
  };
  const [open, setOpen] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState(7);
  const [show, setShow] = useState(false);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const actions = takedownActionsFor(site);
  if (actions.length === 0 && history.length === 0) return null;

  const needsReason = open === "take_offline" || open === "schedule_deletion";
  const addressOk = address.trim().toLowerCase() === (site.subdomain ?? "");
  const blocked = open === "delete_now" && Boolean(blockers?.job || blockers?.payment);
  const ready =
    note.trim().length >= 3 &&
    (!needsReason || reason !== "") &&
    (open !== "delete_now" || addressOk) &&
    !blocked;

  function close() {
    setOpen(null);
    setReason("");
    setNote("");
    setDays(7);
    setShow(false);
    setAddress("");
  }

  async function confirm() {
    if (!open) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await adminPost<{ hosting?: string }>(`/api/admin/sites/${site.id}/decide`, {
        action: open,
        note: note.trim(),
        ...(needsReason ? { reason } : {}),
        ...(open === "take_offline" ? { public: show } : {}),
        ...(open === "schedule_deletion" ? { days } : {}),
        ...(open === "delete_now" ? { address: address.trim().toLowerCase() } : {}),
      });
      const done =
        open === "delete_now"
          ? "Site excluído. O registro ficou no log."
          : result.hosting === "off" || result.hosting === "failed"
            ? "Registrado, mas a hospedagem não respondeu: o endereço pode demorar a mudar. Tente de novo."
            : `${actionTitles[open]}: feito e registrado no log.`;
      close();
      await onDone(done);
      setMessage(done);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Não foi possível salvar.");
    }
    setBusy(false);
  }

  return (
    <section
      aria-labelledby="retirada"
      className="grid gap-4 rounded-xl border border-input bg-card p-5"
    >
      <h2 id="retirada" className="font-display text-[1.5rem]">
        Retirada do ar
      </h2>

      <State site={site} />

      {open ? (
        <form
          className="grid gap-4"
          aria-label={actionTitles[open]}
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) void confirm();
          }}
        >
          <p className="text-[1.0625rem] font-semibold">{actionTitles[open]}</p>
          {open === "delete_now" && (
            <p className="text-[0.9375rem]">
              Apaga agora o site, as respostas, os arquivos, a cópia publicada e o domínio próprio.
              Ficam as cobranças pagas, os aceites dos Termos e este registro. Não pode ser
              desfeito.
            </p>
          )}
          {blocked && (
            <p role="alert" className="text-[0.9375rem] font-semibold text-destructive">
              {blockers?.job
                ? "Há uma tarefa em andamento para este site. Espere ela terminar."
                : "Há uma cobrança pendente. Resolva o pagamento antes de excluir."}
            </p>
          )}
          {needsReason && (
            <div className="grid gap-2">
              <label htmlFor={ids.reason} className="text-[0.9375rem] font-semibold">
                Motivo
              </label>
              <select
                id={ids.reason}
                value={reason}
                required
                onChange={(event) => setReason(event.target.value)}
                className="h-[3.25rem] max-w-sm rounded-xl border border-input bg-card px-3"
              >
                <option value="">Escolha o motivo</option>
                {teamReasons.map((item) => (
                  <option key={item} value={item}>
                    {reasonLabels[item]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {open === "schedule_deletion" && (
            <div className="grid gap-2">
              <label htmlFor={ids.days} className="text-[0.9375rem] font-semibold">
                Excluir daqui a quantos dias (0 a 30)
              </label>
              <Input
                id={ids.days}
                type="number"
                min={0}
                max={30}
                value={days}
                onChange={(event) =>
                  setDays(Math.max(0, Math.min(30, Number.parseInt(event.target.value, 10) || 0)))
                }
                className="max-w-32"
              />
            </div>
          )}
          <div className="grid gap-2">
            <label htmlFor={ids.note} className="text-[0.9375rem] font-semibold">
              {open === "take_offline" && show
                ? "Nota (o cliente vê este texto)"
                : "Nota (fica no log)"}
            </label>
            <textarea
              id={ids.note}
              value={note}
              maxLength={open === "take_offline" && show ? 300 : 1000}
              rows={3}
              aria-describedby={ids.why}
              onChange={(event) => setNote(event.target.value)}
              className="rounded-lg border border-input bg-card p-3 text-base outline-none focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/15"
            />
            <p id={ids.why} className="text-sm text-ink-soft">
              Com 3 letras ou mais.
            </p>
          </div>
          {open === "take_offline" && (
            <label htmlFor={ids.show} className="flex min-h-11 items-center gap-3 text-[0.9375rem]">
              <input
                id={ids.show}
                type="checkbox"
                checked={show}
                onChange={(event) => setShow(event.target.checked)}
                className="size-5 accent-leaf-deep"
              />
              Mostrar a nota ao cliente na página do site
            </label>
          )}
          {open === "delete_now" && (
            <div className="grid gap-2">
              <label htmlFor={ids.address} className="text-[0.9375rem] font-semibold">
                Para confirmar, digite <span className="font-mono">{site.subdomain}</span>
              </label>
              <Input
                id={ids.address}
                value={address}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(event) => setAddress(event.target.value)}
                className="max-w-sm font-mono"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              size="lg"
              variant={open === "delete_now" ? "destructive" : "default"}
              aria-busy={busy || undefined}
              disabled={busy || !ready}
              className="h-auto min-h-12 py-3 text-center whitespace-normal"
            >
              {busy ? "Salvando…" : `Confirmar: ${actionTitles[open].toLowerCase()}`}
            </Button>
            <Button type="button" variant="ghost" size="lg" disabled={busy} onClick={close}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        actions.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {actions.map((action) => (
              <Button
                key={action}
                variant="outline"
                size="lg"
                // Deleting now sits apart, at the end (Fitts).
                className={action === "delete_now" ? "text-destructive sm:ml-auto" : undefined}
                onClick={() => {
                  setMessage(null);
                  setOpen(action);
                }}
              >
                {actionTitles[action]}
              </Button>
            ))}
          </div>
        )
      )}

      <p role="status" className="text-[0.9375rem] font-semibold empty:hidden">
        {message}
      </p>

      {history.length > 0 && (
        <div className="grid gap-2">
          <h3 className="text-[1.0625rem] font-semibold">Registro</h3>
          <ol className="grid gap-2 border-l border-line-strong pl-5 text-[0.9375rem]">
            {history.map((row) => (
              <li key={`${row.created_at}-${row.action}`} className="grid gap-0.5">
                <span>
                  {actorLabels[row.actor] ?? row.actor}: {takedownLabels[row.action] ?? row.action}
                  {row.reason ? ` (${reasonLabels[row.reason] ?? row.reason})` : ""}
                  {row.delete_after ? `, para ${when(row.delete_after)}` : ""}
                  {row.note ? `: ${row.note}` : ""}
                </span>
                <time dateTime={row.created_at} className="text-[0.8125rem] text-ink-soft">
                  {when(row.created_at)}
                </time>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function State({ site }: { site: TakedownSite }) {
  const lines: string[] = [];
  if (site.status === "offline") {
    lines.push(
      site.offline_by === "owner"
        ? "Fora do ar pelo cliente."
        : site.offline_by === "system"
          ? "Fora do ar pela rotina diária."
          : "Fora do ar pela equipe.",
    );
    if (site.offline_public_reason) lines.push(`O cliente vê: “${site.offline_public_reason}”.`);
  }
  if (site.delete_after) {
    lines.push(
      `Exclusão agendada para ${when(site.delete_after)}, por ${site.deletion_by === "owner" ? "pedido do cliente" : "decisão da equipe"}.`,
    );
  }
  if (site.deletion_attempts) {
    lines.push(
      `A rotina tentou excluir ${site.deletion_attempts} ${site.deletion_attempts === 1 ? "vez" : "vezes"} e falhou${site.deletion_error ? `: ${site.deletion_error}` : "."}`,
    );
  }
  if (lines.length === 0) return null;
  return (
    <div className="grid gap-1 text-[0.9375rem]">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
