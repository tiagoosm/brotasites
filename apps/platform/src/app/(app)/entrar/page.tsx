import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre com um link no seu e-mail para criar e acompanhar os seus sites.",
};

export default function SignInPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-5 py-12">
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
