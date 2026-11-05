import { formSteps12 } from "@brotasites/schema/v1.2";
import type { Metadata } from "next";

// The tab says where the person is: "Passo 2 de 5: Marca e sensação" (E25). Set on the server,
// so the layout's default title never replaces it after the page loads.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ passo: string }>;
}): Promise<Metadata> {
  const { passo } = await params;
  const index = formSteps12.findIndex((step) => step.slug === passo);
  const step = formSteps12[index];
  return step ? { title: `Passo ${index + 1} de ${formSteps12.length}: ${step.title}` } : {};
}

export default function StepLayout({ children }: { children: React.ReactNode }) {
  return children;
}
