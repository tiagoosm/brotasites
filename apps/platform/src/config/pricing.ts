// Every price and condition shown on the site, in one place: the home page price section,
// the help answers and the terms read from here (and so will the checkout, once it exists).
// Model (decision of 2026-10-25): a one-time payment per site, no monthly plan.

export const pricing = {
  /** Publishing a site, one-time payment, in BRL. */
  publish: 297,
  /**
   * Launch price for the first clients, in BRL. When set, the page shows `publish` crossed
   * out next to it. Still undecided between 197 and 297, so it starts empty.
   */
  launchPrice: null as number | null,
  /** Hosting included with the payment. */
  hostingMonths: 12,
  /** Changes through the dashboard included after publishing. */
  adjustmentsDays: 30,
  /** Optional yearly renewal to keep the site online after the included hosting, in BRL. */
  renewalPerYear: 99,
  /** Connecting a custom domain, in BRL (the client registers and pays for the domain). */
  customDomain: 97,
  /** Money-back guarantee, in days. */
  guaranteeDays: 7,
  /**
   * False until the guarantee and refund texts are reviewed by a lawyer. While false, those
   * texts carry a visible "pendente de revisão jurídica" mark. Do not publish to
   * production without the owner's confirmation.
   */
  legalReviewed: false,
} as const;

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/** "R$ 297" (whole reais; non-breaking space as Intl writes it). */
export function formatBRL(value: number): string {
  return brl.format(value);
}

/** The price a client pays to publish today: the launch price when there is one. */
export function publishPrice(): number {
  return pricing.launchPrice ?? pricing.publish;
}

export const LEGAL_REVIEW_PENDING = "pendente de revisão jurídica";
