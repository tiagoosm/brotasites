import { formSteps } from "@brotasites/schema";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StepContent } from "@/components/steps/step-content";

export function generateStaticParams() {
  return formSteps.map((step) => ({ etapa: step.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ etapa: string }>;
}): Promise<Metadata> {
  const { etapa } = await params;
  return { title: formSteps.find((step) => step.slug === etapa)?.title ?? "Criar meu site" };
}

export default async function StepPage({ params }: { params: Promise<{ etapa: string }> }) {
  const { etapa } = await params;
  const step = formSteps.find((s) => s.slug === etapa);
  if (!step) notFound();
  return <StepContent step={step.slug} />;
}
