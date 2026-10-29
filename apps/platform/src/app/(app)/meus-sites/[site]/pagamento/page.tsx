"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Notice } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { formatBRL, LEGAL_REVIEW_PENDING, pricing, publishPrice } from "@/config/pricing";

// The checkout. Payments are a stub for now (CLAUDE.md): this screen confirms a test payment,
// and the server accepts it only with PAYMENTS_MODE=stub. Asaas (Pix and card) comes later.

export default function PaymentPage() {
  return (
    <Suspense>
      <Payment />
    </Suspense>
  );
}

function Payment() {
  const router = useRouter();
  const { site } = useParams<{ site: string }>();
  const paymentId = useSearchParams().get("p") ?? "";
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) {
    return (
      <Notice
        title="Pagamento não encontrado"
        text="Volte para o seu site e aprove de novo."
        action={{ href: `/meus-sites/${site}`, label: "Voltar" }}
      />
    );
  }

  async function pay() {
    setPaying(true);
    setError(null);
    const response = await fetch(`/api/payments/${paymentId}/confirm-stub`, {
      method: "POST",
    }).catch(() => null);
    if (response?.ok) {
      router.push(`/meus-sites/${site}`);
      return;
    }
    const body = (await response?.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error ?? "Não foi possível confirmar o pagamento. Tente de novo.");
    setPaying(false);
  }

  return (
    <section aria-labelledby="pagamento" className="mx-auto grid max-w-[34rem] gap-8">
      <div className="grid gap-3">
        <h1 id="pagamento" className="font-display text-[2.5rem] leading-[1.05]">
          Publicar o site
        </h1>
        <p className="text-[1.0625rem] text-ink-soft">Pagamento único. Sem mensalidade.</p>
      </div>
      <div className="grid gap-4 rounded-xl border border-input bg-card p-6">
        <p className="font-display text-[2.25rem] leading-none">{formatBRL(publishPrice())}</p>
        <ul className="grid list-disc gap-1.5 pl-5 text-[0.9375rem]">
          <li>{pricing.hostingMonths} meses de hospedagem</li>
          <li>Ajustes pelo painel por {pricing.adjustmentsDays} dias depois de publicar</li>
          <li>Uma cópia do site para baixar: o site é seu</li>
        </ul>
        <p className="text-sm text-ink-soft">
          Garantia de {pricing.guaranteeDays} dias.
          {!pricing.legalReviewed && ` (Texto ${LEGAL_REVIEW_PENDING}.)`}
        </p>
      </div>
      <div className="grid gap-3 rounded-lg border border-pollen/60 bg-pollen/10 p-4 text-[0.9375rem]">
        <p className="font-semibold">Ambiente de teste</p>
        <p>
          O pagamento por Pix e cartão ainda não está ligado. Este botão simula um pagamento
          aprovado; nada é cobrado.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-[0.9375rem] font-semibold text-destructive">
          {error}
        </p>
      )}
      <Button size="lg" disabled={paying} onClick={() => void pay()} className="justify-self-start">
        {paying ? "Confirmando…" : "Simular pagamento aprovado"}
      </Button>
    </section>
  );
}
