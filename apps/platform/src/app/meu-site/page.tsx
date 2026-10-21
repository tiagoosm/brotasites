import type { Metadata } from "next";
import { SiteStatus } from "./site-status";

export const metadata: Metadata = {
  title: "Meu site",
  description: "Acompanhe o seu site sendo gerado e publicado.",
};

export default function MySitePage() {
  return (
    <main className="min-h-dvh bg-paper px-5 py-8 sm:px-10">
      <SiteStatus />
    </main>
  );
}
