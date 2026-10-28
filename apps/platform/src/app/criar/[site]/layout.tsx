"use client";

import { useParams } from "next/navigation";
import { Loading, Notice, unavailable } from "@/components/shared/page-state";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { useRequiredAccount } from "@/lib/account";
import { FormProvider } from "@/lib/form-store";

// The form of one site. The shell lives in the layout so the answers stay loaded across steps.
export default function SiteFormLayout({ children }: { children: React.ReactNode }) {
  const { site } = useParams<{ site: string }>();
  const account = useRequiredAccount();
  if (account.status === "unavailable") return <Notice {...unavailable} />;
  if (account.status !== "signed-in") return <Loading />;
  return (
    <FormProvider siteId={site} account={{ userId: account.userId, email: account.email }}>
      <WizardShell>{children}</WizardShell>
    </FormProvider>
  );
}
