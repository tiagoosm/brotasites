import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/account/auth-shell";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie a sua conta para responder os 5 passos e guardar os seus sites.",
  robots: { index: false },
};

export default function SignUpPage() {
  return (
    <AuthShell light>
      <Suspense>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  );
}
