import { type FormStepSlug, formSteps } from "@brotasites/schema";

/** Each step is one of the seven questions (copy lives in formSteps, see docs/platform-copy.md). */
export function StepHeader({ step }: { step: FormStepSlug }) {
  const index = formSteps.findIndex((s) => s.slug === step);
  const current = formSteps[index];
  if (!current) return null;
  return (
    <header className="mb-9 grid gap-3">
      {/* Smaller screens already show the step in the header. */}
      <p className="tag hidden text-stem xl:block">
        Pergunta {index + 1} de {formSteps.length} · {current.title}
      </p>
      <h1 className="font-display text-[2.375rem] leading-[1.06] sm:text-[2.75rem]">
        {current.question}
      </h1>
      <p className="max-w-[36ch] text-[1.0625rem] text-ink-soft">{current.description}</p>
    </header>
  );
}
