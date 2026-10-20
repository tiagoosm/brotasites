import type { Metadata } from "next";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { DraftProvider } from "@/lib/draft-store";

export const metadata: Metadata = {
  title: "Criar meu site",
};

// The shell lives in the layout so the live preview survives step changes.
export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return (
    <DraftProvider>
      <WizardShell>{children}</WizardShell>
    </DraftProvider>
  );
}
