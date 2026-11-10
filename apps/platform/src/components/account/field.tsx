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
        <p id={errorId} role="alert" className="text-sm text-destructive">
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
