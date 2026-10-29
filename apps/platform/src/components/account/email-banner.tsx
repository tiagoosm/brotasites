"use client";

import type { AccountState } from "@/lib/account";
import { ResendConfirmation } from "./resend-confirmation";

// Shown while the account's email is not confirmed: the draft can be saved, but sending the
// form and paying wait for the confirmation (checked again by the server and the database).
export function EmailConfirmBanner({ account }: { account: AccountState }) {
  if (account.status !== "signed-in" || account.emailConfirmed || !account.email) return null;
  return (
    <aside
      aria-label="Confirmação do e-mail"
      className="mx-auto mb-6 grid w-full max-w-[60rem] gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-[0.9375rem] text-ink"
    >
      <p>
        <strong>Confirme o seu e-mail.</strong> Você pode salvar o rascunho, mas para ver as 3
        direções e para pagar precisamos que você toque no link que enviamos para{" "}
        <strong>{account.email}</strong>.
      </p>
      <ResendConfirmation email={account.email} />
    </aside>
  );
}
