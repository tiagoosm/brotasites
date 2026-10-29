import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/account/auth-shell";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre na sua conta para criar e acompanhar os seus sites.",
  robots: { index: false },
};

export default function SignInPage() {
  return (
    <AuthShell>
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
