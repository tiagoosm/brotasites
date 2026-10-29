"use client";

import { AccountMenu } from "@/components/account/account-menu";
import { EmailConfirmBanner } from "@/components/account/email-banner";
import { Brand } from "@/components/brand";
import { Loading, Notice, unavailable } from "@/components/shared/page-state";
import { useRequiredAccount } from "@/lib/account";

// Each site's page (/meus-sites/<site>): the list of sites is the dashboard (/painel, E16).
// Signing in is required.
export default function MySitesLayout({ children }: { children: React.ReactNode }) {
  const account = useRequiredAccount();
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex w-full max-w-[60rem] items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Brand />
        {account.status === "signed-in" && <AccountMenu />}
      </header>
      <main className="mx-auto w-full max-w-[60rem] px-5 pb-20 sm:px-8">
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
