"use client";

import { type FormStepSlug12, formSteps12 } from "@brotasites/schema/v1.2";
import { notFound, useParams } from "next/navigation";
import { useEffect } from "react";
import { Loading, Notice } from "@/components/shared/page-state";
import { AddressStep } from "@/components/steps/address-step";
import { BrandStep } from "@/components/steps/brand-step";
import { BusinessStep } from "@/components/steps/business-step";
import { ContactStep } from "@/components/steps/contact-step";
import { ContentStep } from "@/components/steps/content-step";
import { DirectionStep } from "@/components/steps/direction-step";
import { SectionsStep } from "@/components/steps/sections-step";
import { useForm12 } from "@/lib/form-store";

const steps: Record<FormStepSlug12, () => React.ReactNode> = {
  negocio: BusinessStep,
  marca: BrandStep,
  secoes: SectionsStep,
  conteudo: ContentStep,
  contato: ContactStep,
  direcao: DirectionStep,
  endereco: AddressStep,
};

export default function StepPage() {
  const { etapa } = useParams<{ etapa: string }>();
  const { ready, missing } = useForm12();
  const step = formSteps12.find((s) => s.slug === etapa);
  useEffect(() => {
    if (step) document.title = `${step.title} · BrotaSites`;
  }, [step]);
  if (!step) notFound();
  if (!ready) return <Loading />;
  if (missing) {
    return (
      <Notice
        title="Site não encontrado"
        text="Este site não está na sua conta. Confira se entrou com o mesmo e-mail."
        action={{ href: "/meus-sites", label: "Ir para Meus sites" }}
      />
    );
  }
  const Step = steps[step.slug];
  return <Step />;
}
