import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPage } from "./account-page";

export const metadata: Metadata = { title: "Conta", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <AccountPage />
    </Suspense>
  );
}
