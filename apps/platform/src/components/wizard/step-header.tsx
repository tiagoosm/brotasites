"use client";

import {
  type FormStepSlug12 as FormStepSlug,
  formSteps12 as formSteps,
} from "@brotasites/schema/v1.2";
import { useEffect, useRef } from "react";

/** Each step is one of the seven questions (copy lives in formSteps12, docs/form-flow.md). */
export function StepHeader({ step }: { step: FormStepSlug }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const index = formSteps.findIndex((s) => s.slug === step);
  const current = formSteps[index];

  // Each question starts at the top with its title in view (the previous question may have
  // been scrolled down, under the sticky header), and focus moves to the title so screen
  // readers announce the new question.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per question
  useEffect(() => {
    window.scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
  }, [step]);

  if (!current) return null;
  return (
    <header className="mb-9 grid gap-3">
      {/* Smaller screens already show the step in the header. */}
      <p className="tag hidden text-stem xl:block">
        Passo {index + 1} de {formSteps.length} · {current.title}
      </p>
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="scroll-mt-[10rem] font-display text-[2.375rem] leading-[1.06] outline-none sm:text-[2.75rem] xl:scroll-mt-24"
      >
        {current.question}
      </h1>
      <p className="max-w-[36ch] text-[1.0625rem] text-ink-soft">{current.description}</p>
    </header>
  );
}
