"use client";

import { type FormStepSlug, formSteps } from "@brotasites/schema";
import { useRouter } from "next/navigation";
import { StepFooter } from "@/components/wizard/step-footer";
import { StepHeader } from "@/components/wizard/step-header";
import { useDraft } from "@/lib/draft-store";

/** A question whose answers save as the client goes; "Próximo" marks it done and moves on. */
export function StepForm({ step, children }: { step: FormStepSlug; children: React.ReactNode }) {
  const router = useRouter();
  const { completeStep } = useDraft();
  const index = formSteps.findIndex((s) => s.slug === step);
  const next = formSteps[index + 1];

  return (
    <form
      noValidate
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        completeStep(step);
        if (next) router.push(`/criar/${next.slug}`);
      }}
    >
      <StepHeader step={step} />
      <div className="grid gap-10">{children}</div>
      <StepFooter step={step} />
    </form>
  );
}

/** A titled group of choices inside a question. */
export function ChoiceGroup({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 text-[0.9375rem] font-semibold">{legend}</legend>
      {hint && <p className="-mt-2 text-sm text-ink-soft">{hint}</p>}
      {children}
    </fieldset>
  );
}
