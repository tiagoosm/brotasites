"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MfaChallenge } from "@/components/account/mfa";
import { safeNextPath } from "@/lib/supabase/env";

// The second step of signing in, for accounts with an authenticator app (the team).
export function VerifyStep() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("voltar"));
  return (
    <section className="grid gap-6">
      <header className="grid gap-3">
        <h1 className="font-display text-[2.5rem] leading-[1.05]">Verificação em duas etapas</h1>
        <p className="text-[1.0625rem] text-ink-soft">
          Digite o código do seu aplicativo autenticador para terminar de entrar.
        </p>
      </header>
      <MfaChallenge
        onDone={() => {
          router.replace(next);
          router.refresh();
        }}
      />
    </section>
  );
}
