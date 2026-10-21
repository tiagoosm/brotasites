"use client";

import { setTemplate, type Template, templateOptions } from "@brotasites/schema";
import { Check } from "lucide-react";
import { useId } from "react";
import { useDraft } from "@/lib/draft-store";
import { cn } from "@/lib/utils";
import { StepForm } from "./step-form";

export function TemplateStep() {
  const { draft, updateDraft } = useDraft();
  const name = useId();
  const current = draft.design?.template ?? "classico";

  return (
    <StepForm step="modelo">
      <fieldset className="grid gap-3">
        <legend className="sr-only">Modelo do site</legend>
        {templateOptions.map((option) => {
          const checked = current === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                "relative grid gap-1.5 rounded-xl border p-5 transition-[border-color,background-color] duration-150",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf",
                option.available ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                checked
                  ? "border-leaf bg-leaf-wash/60"
                  : "border-input bg-card hover:border-ink-soft",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={checked}
                disabled={!option.available}
                onChange={() => updateDraft((d) => setTemplate(d, option.id as Template))}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-3">
                <span className="font-display text-2xl">{option.name}</span>
                {checked ? (
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-leaf text-white">
                    <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
                  </span>
                ) : (
                  !option.available && <span className="tag text-ink-soft">Em breve</span>
                )}
              </span>
              <span className="text-[0.9375rem] text-ink-soft">{option.description}</span>
            </label>
          );
        })}
      </fieldset>
    </StepForm>
  );
}
