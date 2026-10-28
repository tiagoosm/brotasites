import { publishPrice } from "@/config/pricing";

// Payments behind one interface (CLAUDE.md: Asaas later, a stub for now). The stub has no
// checkout page of its own: the platform shows a test screen and confirms it by hand, and only
// when PAYMENTS_MODE=stub. Asaas will confirm through its webhook instead.

export interface PaymentProvider {
  readonly id: "stub" | "asaas";
  /** Where the client pays a pending payment. */
  checkoutPath(siteId: string, paymentId: string): string;
}

export const stubPayments: PaymentProvider = {
  id: "stub",
  checkoutPath: (siteId, paymentId) => `/meus-sites/${siteId}/pagamento?p=${paymentId}`,
};

/** The configured provider, or null when payments are off. */
export function paymentProvider(): PaymentProvider | null {
  return process.env.PAYMENTS_MODE === "stub" ? stubPayments : null;
}

/** Publishing price in cents, from config/pricing.ts. */
export function publishAmountCents(): number {
  return Math.round(publishPrice() * 100);
}
