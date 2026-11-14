"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { limits } from "@/config/limits";
import { formatBRL, pricing } from "@/config/pricing";
import { CONTACT_EMAIL } from "@/content/contact";
import {
  manageSite,
  SiteActionError,
  type SiteRow,
  type TakedownAction,
  type WithdrawalInfo,
} from "@/lib/sites";

// "Gerenciar o site" (E42): the client takes their published site offline and back, or deletes
// it. Taking offline is reversible and nothing is deleted, so it takes one confirmation. Deleting
// is final, so it goes in steps (Murphy): what goes and what stays, a chance to download the
// site first, then typing the address. It still waits `deletionWaitDays` and can be cancelled.
// No team approval: the team is told. The team's own measures (taking offline with a reason,
// scheduling a deletion, suspending) are explained here but only the team undoes them.
// E43: within `guaranteeDays` of paying, "Desistir da compra" (direito de arrependimento, CDC
// art. 49; Decreto 7.962/2013 art. 5: stated clearly, done through the same tool used to buy,
// receipt confirmed at once) records a refund of the full amount; after that, deleting refunds
// nothing, and the delete steps say so before the client confirms.

type Step = "idle" | "offline" | "delete-what" | "delete-type" | "withdraw";

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });

/** Whole days until `iso`, at least 0. */
export function daysUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000));
}

const dateTimeOf = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

const money = (cents: number) => formatBRL(Math.round(cents) / 100);

const CONTACT_LINE = CONTACT_EMAIL
  ? `Dúvidas sobre o pagamento? Escreva para ${CONTACT_EMAIL}.`
  : "Dúvidas sobre o pagamento? Fale com a equipe pelo endereço da página Ajuda.";

/** Whether the client can still withdraw with a full refund. */
export function canWithdraw(withdrawal: WithdrawalInfo | null | undefined, now = Date.now()) {
  return Boolean(
    withdrawal?.deadline &&
      !withdrawal.request &&
      withdrawal.amountCents &&
      new Date(withdrawal.deadline).getTime() > now,
  );
}

/** What deleting means for the money, said before the client confirms (CDC art. 6, III). */
function paymentNote(withdrawal: WithdrawalInfo | null | undefined): string {
  if (withdrawal?.request) {
    return `A devolução do valor pago já foi pedida. ${CONTACT_LINE}`;
  }
  if (canWithdraw(withdrawal) && withdrawal?.deadline) {
    return `Excluir não devolve o valor pago. Para receber de volta, use “Desistir da compra” até ${dateTimeOf(withdrawal.deadline)}.`;
  }
  if (withdrawal?.deadline) {
    return `Excluir não devolve o valor pago: o prazo de ${pricing.guaranteeDays} dias para desistir com devolução terminou em ${dateOf(withdrawal.deadline)}. ${CONTACT_LINE}`;
  }
  return CONTACT_LINE;
}

export function ManageSite({
  site,
  address,
  busy = false,
  onDownload,
  onChanged,
  withdrawal = null,
}: {
  site: SiteRow;
  /** E43: the payment and the withdrawal, if the publication was paid. */
  withdrawal?: WithdrawalInfo | null;
  /** The site's address on the sites' domain, as the client sees it (no https://). */
  address: string;
  /** Another action is running on the page. */
  busy?: boolean;
  /** Asks for the .zip (the page's own "Baixar o site"). */
  onDownload: () => void;
  /** After a change, so the page loads the site again. */
  onChanged: (message: string) => Promise<void> | void;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [pending, setPending] = useState<TakedownAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const subdomain = site.subdomain ?? "";
  const offline = site.status === "offline";
  const byTeam = offline && site.offline_by !== "owner";
  const deleteAfter = site.delete_after ?? null;
  const deletionByOwner = site.deletion_by === "owner";

  async function run(action: TakedownAction, message: string, typedAddress?: string) {
    setPending(action);
    setError(null);
    try {
      await manageSite(site.id, action, typedAddress);
      setStep("idle");
      setTyped("");
      await onChanged(message);
      headingRef.current?.focus();
    } catch (caught) {
      setError(
        caught instanceof SiteActionError
          ? caught.message
          : "Não foi possível fazer isso agora. Tente de novo.",
      );
    }
    setPending(null);
  }

  const disabled = busy || pending !== null;
  const cancelStep = (
    <Button
      variant="ghost"
      size="lg"
      disabled={pending !== null}
      onClick={() => {
        setStep("idle");
        setTyped("");
        setError(null);
      }}
    >
      Voltar
    </Button>
  );

  const withdrawable = canWithdraw(withdrawal);
  const amount = withdrawal?.amountCents ? money(withdrawal.amountCents) : null;

  // E43: the withdrawal already made (what was received and when), or the offer to withdraw.
  const withdrawalBlock =
    step !== "idle" ? null : withdrawal?.request ? (
      <div className="grid gap-1.5 rounded-lg border border-line p-4 text-[0.9375rem]">
        <p className="font-semibold">
          {withdrawal.request.status === "refunded"
            ? `Valor devolvido: ${money(withdrawal.request.amountCents)}`
            : `Desistência recebida em ${dateTimeOf(withdrawal.request.requestedAt)}`}
        </p>
        <p className="text-ink-soft">
          {withdrawal.request.status === "refunded"
            ? `A devolução foi feita${withdrawal.request.resolvedAt ? ` em ${dateOf(withdrawal.request.resolvedAt)}` : ""}, pelo mesmo meio de pagamento. O prazo para aparecer depende do banco ou do cartão.`
            : `Vamos devolver ${money(withdrawal.request.amountCents)} pelo mesmo meio de pagamento. Nossa equipe já foi avisada; o prazo para aparecer depende do banco ou do cartão.`}
        </p>
      </div>
    ) : withdrawable && withdrawal?.deadline && amount ? (
      <div className="grid gap-2 rounded-lg border border-line p-4">
        <p className="text-[0.9375rem]">
          <strong>Desistiu da compra?</strong> Até {dateTimeOf(withdrawal.deadline)} você pode
          desistir e receber de volta os {amount} pagos (direito de arrependimento, Código de Defesa
          do Consumidor, art. 49).
        </p>
        <Button
          variant="outline"
          size="lg"
          className="justify-self-start"
          disabled={disabled}
          onClick={() => setStep("withdraw")}
        >
          Desistir da compra
        </Button>
      </div>
    ) : null;

  let body: React.ReactNode;
  if (step === "withdraw" && amount) {
    body = (
      <div className="grid gap-3">
        <p className="text-[0.9375rem]">
          Desistir da compra e receber de volta <strong>{amount}</strong>? O site sai do ar agora e
          é excluído em {pricing.guaranteeDays} dias; até lá, baixe a cópia se quiser. A devolução é
          feita pelo mesmo meio de pagamento.
        </p>
        <DownloadLine onDownload={onDownload} disabled={disabled} />
        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            variant="destructive"
            className="h-auto min-h-12 py-3 text-center whitespace-normal"
            aria-busy={pending === "withdraw" || undefined}
            disabled={disabled}
            onClick={() =>
              run(
                "withdraw",
                `Desistência recebida. Vamos devolver ${amount} pelo mesmo meio de pagamento.`,
              )
            }
          >
            {pending === "withdraw" ? "Enviando…" : `Sim, desistir e receber ${amount}`}
          </Button>
          {cancelStep}
        </div>
      </div>
    );
  } else if (site.status === "suspended") {
    // Suspended: only the withdrawal (the right does not depend on the team's measures).
    body = null;
  } else if (deleteAfter) {
    const days = daysUntil(deleteAfter);
    body = (
      <div className="grid gap-3">
        <p className="text-[0.9375rem]">
          <strong>
            Este site será excluído em {dateOf(deleteAfter)}
            {days > 0 ? ` (daqui a ${days} ${days === 1 ? "dia" : "dias"})` : ""}.
          </strong>{" "}
          Até lá ele fica fora do ar e nada foi apagado.
        </p>
        {deletionByOwner && !withdrawal?.request ? (
          <>
            <p className="text-[0.9375rem] text-ink-soft">
              Mudou de ideia? Cancele a exclusão. O site continua fora do ar até você recolocá-lo.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="justify-self-start"
              aria-busy={pending === "cancel" || undefined}
              disabled={disabled}
              onClick={() => run("cancel", "Exclusão cancelada. O site continua fora do ar.")}
            >
              {pending === "cancel" ? "Cancelando…" : "Cancelar a exclusão"}
            </Button>
          </>
        ) : (
          <p className="text-[0.9375rem] text-ink-soft">
            {withdrawal?.request
              ? "Você desistiu da compra, então a exclusão segue."
              : "A exclusão foi agendada pela equipe."}
            {CONTACT_EMAIL ? ` Para conversar sobre isso, escreva para ${CONTACT_EMAIL}.` : ""}
          </p>
        )}
        <DownloadLine onDownload={onDownload} disabled={disabled} />
      </div>
    );
  } else if (step === "offline") {
    body = (
      <div className="grid gap-3">
        <p className="text-[0.9375rem]">
          Tirar <strong>{address}</strong> do ar? Quem visitar verá a página “Site fora do ar”,
          também no seu domínio próprio, se tiver. Nada é apagado e você recoloca quando quiser.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            aria-busy={pending === "offline" || undefined}
            disabled={disabled}
            onClick={() => run("offline", "O site saiu do ar. Nada foi apagado.")}
          >
            {pending === "offline" ? "Tirando do ar…" : "Sim, tirar do ar"}
          </Button>
          {cancelStep}
        </div>
      </div>
    );
  } else if (step === "delete-what") {
    body = (
      <div className="grid gap-4">
        <p className="text-[0.9375rem]">
          O site sai do ar agora e é excluído daqui a {limits.deletionWaitDays} dias. Até lá, você
          pode cancelar.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <h3 className="text-[0.9375rem] font-semibold">O que é apagado</h3>
            <ul className="grid list-disc gap-1 pl-5 text-[0.9375rem] text-ink-soft">
              <li>O site, os textos, as fotos e as direções</li>
              <li>O endereço {address} e a ligação com o seu domínio próprio</li>
              <li>O histórico deste site em Meus sites</li>
            </ul>
          </div>
          <div className="grid content-start gap-1.5">
            <h3 className="text-[0.9375rem] font-semibold">O que fica</h3>
            <ul className="grid list-disc gap-1 pl-5 text-[0.9375rem] text-ink-soft">
              <li>Os registros de pagamento</li>
              <li>A sua conta e os seus outros sites</li>
              <li>O seu domínio próprio no registrador: ele é seu</li>
            </ul>
          </div>
        </div>
        <p className="text-[0.9375rem] text-ink-soft">
          O endereço fica reservado para você por {limits.subdomainHoldDays} dias.{" "}
          {paymentNote(withdrawal)}
        </p>
        <DownloadLine onDownload={onDownload} disabled={disabled} />
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="lg"
            className="text-destructive"
            disabled={disabled}
            onClick={() => setStep("delete-type")}
          >
            Continuar
          </Button>
          {cancelStep}
        </div>
      </div>
    );
  } else if (step === "delete-type") {
    const matches = typed.trim().toLowerCase() === subdomain;
    body = (
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!matches) {
            setError("O endereço digitado não confere. Digite exatamente o endereço do site.");
            return;
          }
          void run(
            "schedule",
            `Exclusão agendada para daqui a ${limits.deletionWaitDays} dias. O site já saiu do ar.`,
            typed.trim().toLowerCase(),
          );
        }}
      >
        <label htmlFor={inputId} className="text-[0.9375rem]">
          Para confirmar, digite <strong className="font-mono">{subdomain}</strong>
        </label>
        <Input
          id={inputId}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="url"
          className="max-w-sm font-mono"
          aria-invalid={Boolean(error) || undefined}
        />
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            variant="destructive"
            size="lg"
            aria-busy={pending === "schedule" || undefined}
            disabled={disabled || !matches}
          >
            {pending === "schedule"
              ? "Agendando…"
              : `Excluir daqui a ${limits.deletionWaitDays} dias`}
          </Button>
          {cancelStep}
        </div>
      </form>
    );
  } else {
    body = (
      <div className="grid gap-4">
        {offline && !byTeam && (
          <div className="grid gap-3">
            <p className="text-[0.9375rem]">
              Você tirou o site do ar. Nada foi apagado: recoloque quando quiser.
            </p>
            <Button
              size="lg"
              className="justify-self-start"
              aria-busy={pending === "online" || undefined}
              disabled={disabled}
              onClick={() => run("online", "O site voltou ao ar.")}
            >
              {pending === "online" ? "Recolocando…" : "Recolocar no ar"}
            </Button>
          </div>
        )}
        {byTeam && (
          <p className="text-[0.9375rem]">
            A equipe tirou o site do ar
            {site.offline_public_reason ? `: ${site.offline_public_reason}` : "."}{" "}
            {CONTACT_EMAIL
              ? `Para conversar sobre isso, escreva para ${CONTACT_EMAIL}.`
              : "Fale com a equipe pelo endereço da página Ajuda."}
          </p>
        )}
        {!offline && (
          <div className="grid gap-2">
            <p className="text-[0.9375rem] text-ink-soft">
              Pausa o site sem apagar nada. Você recoloca quando quiser.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="justify-self-start"
              disabled={disabled}
              onClick={() => setStep("offline")}
            >
              Tirar do ar
            </Button>
          </div>
        )}
        <div className="grid gap-2">
          <p className="text-[0.9375rem] text-ink-soft">
            Apaga o site depois de {limits.deletionWaitDays} dias. Dá para cancelar até lá.
          </p>
          <Button
            variant="ghost"
            size="lg"
            className="justify-self-start px-3 text-destructive"
            disabled={disabled}
            onClick={() => setStep("delete-what")}
          >
            Excluir o site
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="gerenciar" className="grid gap-4 border-t border-line pt-8">
      <h2
        id="gerenciar"
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-[1.375rem] leading-tight focus:outline-none"
      >
        {step === "delete-what" || step === "delete-type"
          ? "Excluir o site"
          : step === "withdraw"
            ? "Desistir da compra"
            : "Gerenciar o site"}
      </h2>
      {withdrawalBlock}
      {body}
      {error && (
        <p role="alert" className="text-[0.9375rem] font-semibold text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function DownloadLine({ onDownload, disabled }: { onDownload: () => void; disabled: boolean }) {
  return (
    <p className="text-[0.9375rem] text-ink-soft">
      Quer guardar uma cópia?{" "}
      <button
        type="button"
        disabled={disabled}
        onClick={onDownload}
        className="touch-target font-semibold text-leaf-deep underline underline-offset-4 disabled:opacity-60"
      >
        Baixar o site (.zip)
      </button>
    </p>
  );
}
