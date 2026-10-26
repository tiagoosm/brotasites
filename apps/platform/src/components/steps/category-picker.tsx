"use client";

import { categories } from "@brotasites/schema";
import { Check } from "lucide-react";
import { useId } from "react";
import { chipClass } from "@/components/shared/chip";
import { cn } from "@/lib/utils";

export const OTHER = "outro";
export const listedCategories = categories.filter((category) => category.id !== OTHER);

/** Picker value for a stored category: a listed id, or "outro" for a custom one. */
export function pickerValueFor(category: string | undefined): string {
  if (!category) return "";
  return listedCategories.find((c) => c.label === category)?.id ?? OTHER;
}

// Native radio buttons styled as tags: arrow keys and screen readers work as expected.
export function CategoryPicker({
  value,
  onChange,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const name = useId();
  const options = [
    ...listedCategories.map((c) => ({ id: c.id, label: c.label })),
    { id: OTHER, label: "Outro tipo" },
  ];

  return (
    <div className="flex flex-wrap gap-2" aria-describedby={describedBy}>
      {options.map((option) => {
        const checked = value === option.id;
        return (
          <label
            key={option.id}
            className={cn(
              chipClass({ checked, invalid }),
              "touch-target cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={checked}
              onChange={() => onChange(option.id)}
              className="sr-only"
              aria-invalid={invalid || undefined}
            />
            {checked && <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />}
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
