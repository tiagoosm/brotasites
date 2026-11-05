"use client";

import { type FormStepSlug12, formSteps12 } from "@brotasites/schema/v1.2";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loading, Notice } from "@/components/shared/page-state";
import { BrandStep } from "@/components/steps/brand-step";
import { BusinessStep } from "@/components/steps/business-step";
import { ContactStep } from "@/components/steps/contact-step";
import { ContentStep } from "@/components/steps/content-step";
import { SectionsStep } from "@/components/steps/sections-step";
import { useForm12 } from "@/lib/form-store";

const steps: Record<FormStepSlug12, () => React.ReactNode> = {
  negocio: BusinessStep,
  marca: BrandStep,
  secoes: SectionsStep,
  conteudo: ContentStep,
  contato: ContactStep,
};

export default function StepPage() {
  const { passo } = useParams<{ passo: string }>();
  const router = useRouter();
  const { ready, missing, siteId, completed, isReachable } = useForm12();
  const step = formSteps12.find((s) => s.slug === passo);
  const ahead = Boolean(step && ready && !missing && !isReachable(step.slug));
  // A step ahead of the person's progress sends them to the first one still open.
  useEffect(() => {
    if (!ahead) return;
    const open = formSteps12.find((s) => !completed.includes(s.slug)) ?? formSteps12[0];
    router.replace(`/criar/${siteId}/${open.slug}`);
  }, [ahead, completed, router, siteId]);
  if (!step) notFound();
  if (!ready || ahead) return <Loading />;
  if (missing) {
    return (
      <Notice
        title="Site não encontrado"
        text="Este site não está na sua conta. Confira se entrou com o mesmo e-mail."
        action={{ href: "/painel", label: "Ir para o painel" }}
      />
    );
  }
  const Step = steps[step.slug];
  return <Step />;
}
