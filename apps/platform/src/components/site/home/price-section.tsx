import { Check } from "lucide-react";
import { GlowCard } from "@/components/site/home/glow-card";
import { SplitWords } from "@/components/site/split-words";
import { formatBRL, LEGAL_REVIEW_PENDING, pricing } from "@/config/pricing";

// "Quanto custa": creating is free, publishing is a one-time payment. Every value comes from
// src/config/pricing.ts.

function Price() {
  const launch = pricing.launchPrice;
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {launch !== null && (
        <span className="text-[1.25rem] text-ink-soft line-through">
          <span className="sr-only">De </span>
          {formatBRL(pricing.publish)}
        </span>
      )}
      <span className="font-display text-[3rem] leading-none">
        {launch !== null && <span className="sr-only">por </span>}
        {formatBRL(launch ?? pricing.publish)}
      </span>
      <span className="text-[0.9375rem] text-ink-soft">
        pagamento único{launch !== null && ", preço de lançamento"}
      </span>
    </p>
  );
}

export function PriceSection() {
  const included = [
    `${pricing.hostingMonths} meses de hospedagem`,
    `Ajustes pelo painel nos primeiros ${pricing.adjustmentsDays} dias`,
    "O site é seu: baixe o site pronto quando quiser e hospede onde preferir",
  ];
  return (
    <section id="preco" aria-labelledby="preco-titulo" className="scroll-mt-16 bg-table">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 sm:py-28 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20">
        <header className="grid content-start gap-4">
          <SplitWords
            as="h2"
            id="preco-titulo"
            className="font-display text-[2.25rem] leading-[1.08] sm:text-[2.75rem]"
            segments={[{ text: "Quanto custa" }]}
          />
          <p data-reveal="" className="text-[1.0625rem] text-ink-soft">
            Criar, editar, ver as direções e o site pronto é grátis. Você só paga se quiser colocar
            o site no ar.
          </p>
        </header>

        <div className="isolate grid gap-6">
          <GlowCard
            data-reveal=""
            className="grid gap-5 rounded-2xl border border-line bg-card p-6 sm:p-8"
          >
            <div className="grid gap-2">
              <h3 className="font-sans text-[1.0625rem] font-semibold tracking-normal">
                Publicar o seu site
              </h3>
              <Price />
              <p className="text-ink-soft">
                No endereço{" "}
                <span className="font-mono text-[0.9375rem]">seunegocio.brotasites.com</span>
              </p>
            </div>
            <div className="grid gap-3 border-t border-line pt-5">
              <p className="tag text-[0.75rem] text-stem">Incluído</p>
              <ul className="grid gap-2.5">
                {included.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-leaf" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </GlowCard>

          <dl className="grid gap-5 sm:grid-cols-3 sm:gap-6">
            <div data-reveal="" className="grid content-start gap-1.5">
              <dt className="font-semibold">Depois de {pricing.hostingMonths} meses</dt>
              <dd className="text-[0.9375rem] text-ink-soft">
                Manter no ar custa {formatBRL(pricing.renewalPerYear)} por ano, se você quiser. Quem
                não renovar pode baixar o site antes de ele sair do ar.
              </dd>
            </div>
            <div data-reveal="" className="grid content-start gap-1.5">
              <dt className="font-semibold">Domínio próprio</dt>
              <dd className="text-[0.9375rem] text-ink-soft">
                + {formatBRL(pricing.customDomain)} para conectar. Você registra o domínio e paga o
                registro direto ao registrador.
              </dd>
            </div>
            <div data-reveal="" className="grid content-start gap-1.5">
              <dt className="font-semibold">Garantia de {pricing.guaranteeDays} dias</dt>
              <dd className="text-[0.9375rem] text-ink-soft">
                Se não gostar, devolvemos o valor.
                {!pricing.legalReviewed && (
                  <span className="tag mt-2 block text-[0.75rem] text-ink-soft">
                    Texto {LEGAL_REVIEW_PENDING}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
