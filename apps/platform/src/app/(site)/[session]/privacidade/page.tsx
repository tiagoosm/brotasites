import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { privacySections } from "@/content/legal";

export const metadata: Metadata = {
  title: "Privacidade",
  description:
    "Quais dados o BrotaSites coleta, para que usa, onde guarda e quais são os seus direitos.",
  alternates: { canonical: "/privacidade" },
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacidade" title="Política de privacidade" sections={privacySections} />
  );
}
