import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/account/auth-shell";
import { VerifyStep } from "./verify-step";

export const metadata: Metadata = { title: "Verificação em duas etapas", robots: { index: false } };

export default function VerifyPage() {
  return (
    <AuthShell>
      <Suspense>
        <VerifyStep />
      </Suspense>
    </AuthShell>
  );
}
