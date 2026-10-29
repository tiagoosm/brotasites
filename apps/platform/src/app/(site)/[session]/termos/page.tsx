import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { termsSections } from "@/content/legal";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "As regras para usar o BrotaSites, em linguagem simples.",
  alternates: { canonical: "/termos" },
};

export default function TermsPage() {
  return <LegalPage eyebrow="Termos" title="Termos de uso" sections={termsSections} />;
}
