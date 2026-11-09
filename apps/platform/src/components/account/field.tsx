"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";

// A labeled field whose hint and error are tied to it (aria-describedby), as in docs/platform-design.md.

export function Field({
  label,
  hint,
  error,
  inputRef,
  ...input
}: React.ComponentProps<typeof Input> & {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const generated = useId();
  const id = input.id ?? generated;
  const hintId = `${id}-dica`;
  const errorId = `${id}-erro`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        {label}
      </label>
      <Input
        ref={inputRef}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
        id={id}
      />
      {/* The error first, right under the field (proximity). */}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-sm text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * What to fix before sending (E26, Murphy and peak-end): a short list at the top of the form,
 * each item a link to its field. Focus goes to the first field with an error; this list is read
 * when it appears.
 */
export function ErrorSummary({
  errors,
  labels,
}: {
  errors: Record<string, string>;
  /** The fields, in the form's order: key → [input id, label]. */
  labels: [key: string, id: string, label: string][];
}) {
  const listed = labels.filter(([key]) => errors[key]);
  if (listed.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      <p className="font-semibold">
        {listed.length === 1 ? "Confira 1 campo:" : `Confira ${listed.length} campos:`}
      </p>
      <ul className="mt-1 flex flex-wrap gap-x-4">
        {listed.map(([key, id, label]) => (
          <li key={key}>
            <a
              href={`#${id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(id)?.focus();
              }}
              className="touch-target underline underline-offset-4"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** An error for the whole form, read out when it appears. */
export function FormError({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
