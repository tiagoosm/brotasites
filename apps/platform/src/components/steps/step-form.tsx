"use client";

import { type FormStepSlug12, formSteps12 } from "@brotasites/schema/v1.2";
import { useRouter } from "next/navigation";
import { StepFooter } from "@/components/wizard/step-footer";
import { StepHeader } from "@/components/wizard/step-header";
import { useForm12 } from "@/lib/form-store";

/**
 * A question whose answers save as the client goes. "Próximo" runs `validate` (when given):
 * a message stops the step and shows it; otherwise the step is done and the next one opens.
 */
export function StepForm({
  step,
  validate,
  action,
  children,
}: {
  step: FormStepSlug12;
  validate?: () => string | null;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { completeStep, siteId } = useForm12();
  const index = formSteps12.findIndex((s) => s.slug === step);
  const next = formSteps12[index + 1];

  return (
    <form
      noValidate
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        const problem = validate?.();
        const status = document.getElementById("step-problem");
        if (problem) {
          if (status) status.textContent = problem;
          status?.focus();
          return;
        }
        if (status) status.textContent = "";
        completeStep(step);
        if (next) router.push(`/criar/${siteId}/${next.slug}`);
      }}
    >
      <StepHeader step={step} />
      <div className="grid gap-10">{children}</div>
      <p
        id="step-problem"
        role="alert"
        tabIndex={-1}
        className="mt-6 text-[0.9375rem] font-semibold text-destructive empty:hidden"
      />
      <StepFooter step={step} action={action} />
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

/** A note that a part of the form is locked or waiting. */
export function LockedNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-border bg-paper p-4 text-[0.9375rem] text-ink-soft">
      {children}
    </p>
  );
}
