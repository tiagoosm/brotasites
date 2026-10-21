"use client";

import { Plus, X } from "lucide-react";
import { useId, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Plain fields for questions that save as the client types (no submit validation).

interface TextFieldProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  hint?: string;
  /** Message shown in place of the hint when the value cannot be used. */
  error?: string;
  multiline?: boolean;
  type?: React.HTMLInputTypeAttribute;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
}

/** A labeled field. Long texts show how much room is left once it starts to run out. */
export function TextField({
  label,
  value = "",
  onChange,
  placeholder,
  maxLength,
  hint,
  error,
  multiline = false,
  type = "text",
  autoComplete = "off",
  inputMode,
  className,
}: TextFieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const left = maxLength - value.length;
  const showCount = multiline || left <= 10;
  const note = error ?? hint;

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.9375rem] font-semibold">
          {label}
        </label>
        {showCount && (
          <span
            className={cn("tag shrink-0", left <= 10 ? "text-destructive" : "text-ink-soft")}
            aria-hidden="true"
          >
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-describedby={note ? noteId : undefined}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-describedby={note ? noteId : undefined}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {note && (
        <p id={noteId} className={cn("text-sm", error ? "text-destructive" : "text-ink-soft")}>
          {note}
        </p>
      )}
    </div>
  );
}

/** A card for one part of the site: its name, a short note and its fields. */
export function SectionCard({
  name,
  note,
  children,
}: {
  name: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-5 rounded-xl border border-input bg-card p-5 sm:p-6">
      <legend className="sr-only">{name}</legend>
      <div aria-hidden="true" className="-mb-1 flex items-center gap-3">
        <span className="h-px w-5 bg-stem" />
        <span className="font-display text-[1.375rem] leading-none">{name}</span>
      </div>
      {note && <div className="-mt-2 text-sm text-ink-soft">{note}</div>}
      {children}
    </fieldset>
  );
}

/**
 * A growing list (services, questions, testimonials). Each row gets a remove button and
 * focus moves to the new row's first field when one is added.
 */
export function ItemList<T>({
  items,
  max,
  itemName,
  addLabel,
  newItem,
  onChange,
  renderItem,
}: {
  items: T[];
  max: number;
  /** Used in the row labels: "Serviço 2". */
  itemName: string;
  addLabel: string;
  newItem: () => T;
  onChange: (items: T[]) => void;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode;
}) {
  const listRef = useRef<HTMLOListElement>(null);

  function focusRow(index: number) {
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-row="${index}"] :is(input, textarea)`)
        ?.focus();
    });
  }

  return (
    <div className="grid gap-3">
      <ol ref={listRef} className="grid gap-3">
        {items.map((item, index) => (
          <li
            // Rows have no ids of their own; values are controlled, so index keys are safe.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            key={index}
            data-row={index}
            className="grid gap-4 rounded-lg border border-border bg-paper p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="tag text-stem">
                {itemName} {index + 1}
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(items.filter((_, i) => i !== index));
                    focusRow(Math.max(0, index - 1));
                  }}
                  aria-label={`Remover ${itemName.toLocaleLowerCase("pt-BR")} ${index + 1}`}
                  className="inline-flex size-8 items-center justify-center rounded-full text-ink-soft transition-colors duration-150 hover:bg-table hover:text-ink"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>
            {renderItem(
              item,
              (patch) =>
                onChange(items.map((row, i) => (i === index ? { ...row, ...patch } : row))),
              index,
            )}
          </li>
        ))}
      </ol>
      {items.length < max ? (
        <button
          type="button"
          onClick={() => {
            onChange([...items, newItem()]);
            focusRow(items.length);
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong text-[0.9375rem] font-semibold text-leaf-deep transition-colors duration-150 hover:border-leaf hover:bg-leaf-wash/50"
        >
          <Plus aria-hidden="true" className="size-4" />
          {addLabel}
        </button>
      ) : (
        <p className="text-sm text-ink-soft">Você chegou ao limite de {max}.</p>
      )}
    </div>
  );
}
