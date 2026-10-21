"use client";

import { type FormStepSlug, formSteps } from "@brotasites/schema";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { StepFooter } from "@/components/wizard/step-footer";
import { StepHeader } from "@/components/wizard/step-header";
import { useDraft } from "@/lib/draft-store";
import { BusinessStep } from "./business-step";
import { ContactStep } from "./contact-step";
import { ContentStep } from "./content-step";
import { DesignStep } from "./design-step";
import { SectionsStep } from "./sections-step";
import { TemplateStep } from "./template-step";

export function StepContent({ step }: { step: FormStepSlug }) {
  const { ready, isReachable } = useDraft();
  const router = useRouter();
  const blocked = ready && !isReachable(step);

  // Steps ahead of the client's progress send them back to the start.
  useEffect(() => {
    if (blocked) router.replace("/criar/negocio");
  }, [blocked, router]);

  // Wait for the saved draft so fields start with the client's values.
  if (!ready) return <p className="text-ink-soft">Abrindo o seu rascunho…</p>;
  if (blocked) return null;

  switch (step) {
    case "negocio":
      return <BusinessStep />;
    case "modelo":
      return <TemplateStep />;
    case "cores":
      return <DesignStep />;
    case "secoes":
      return <SectionsStep />;
    case "conteudo":
      return <ContentStep />;
    case "contato":
      return <ContactStep />;
    default:
      return <UpcomingStep step={step} />;
  }
}

/** Steps that are not built yet still let the client move forward. */
function UpcomingStep({ step }: { step: FormStepSlug }) {
  const router = useRouter();
  const { completeStep } = useDraft();
  const index = formSteps.findIndex((s) => s.slug === step);
  const next = formSteps[index + 1];

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        completeStep(step);
        if (next) router.push(`/criar/${next.slug}`);
      }}
    >
      <StepHeader step={step} />
      <p className="rounded-lg border border-dashed border-border p-4 text-ink-soft">
        Esta pergunta ainda está em construção. Siga para a próxima.
      </p>
      <StepFooter step={step} />
    </form>
  );
}
