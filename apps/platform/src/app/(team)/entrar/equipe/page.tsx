import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamSignInForm } from "./team-sign-in-form";

// The team's own sign-in (E33): where /entrar leads on admin.brotasites.com.br. Nothing of the
// clients' site: no sign-up, no "Esqueci a senha" (the reset lives on the platform), no product.
export const metadata: Metadata = {
  title: "Entrar na área da equipe",
  robots: { index: false, follow: false },
};

export default function TeamSignInPage() {
  return (
    <main className="grid min-h-[calc(100dvh-4rem-1px)] place-items-center px-4 py-6 sm:px-5">
      <div
        data-auth-card
        className="w-full max-w-[26rem] rounded-2xl border border-paper/10 bg-paper px-6 py-8 text-ink shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)] sm:px-9 sm:py-9 [@media(max-height:700px)]:py-7"
      >
        <Suspense>
          <TeamSignInForm />
        </Suspense>
      </div>
    </main>
  );
}
