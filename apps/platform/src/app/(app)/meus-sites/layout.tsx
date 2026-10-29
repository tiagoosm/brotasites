"use client";

import { EmailConfirmBanner } from "@/components/account/email-banner";
import { Loading, Notice, unavailable } from "@/components/shared/page-state";
import { useRequiredAccount } from "@/lib/account";

// Each site's page (/meus-sites/<site>): the list of sites is the dashboard (/painel, E16).
// Signing in is required.
export default function MySitesLayout({ children }: { children: React.ReactNode }) {
  const account = useRequiredAccount();
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-paper">
      <main className="mx-auto w-full max-w-[60rem] px-5 pt-8 pb-20 sm:px-8">
        {account.status === "unavailable" ? (
          <Notice {...unavailable} />
        ) : account.status === "signed-in" ? (
          <>
            <EmailConfirmBanner account={account} />
            {children}
          </>
        ) : (
          <Loading />
        )}
      </main>
    </div>
  );
}
