import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPage } from "./account-page";

export const metadata: Metadata = { title: "Perfil e segurança", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <AccountPage />
    </Suspense>
  );
}
