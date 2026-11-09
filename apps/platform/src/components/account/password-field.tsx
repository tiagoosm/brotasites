"use client";

import { Check, Eye, EyeOff, Minus } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  lengthRequirement,
  type PasswordOwner,
  passwordHints,
  passwordStrength,
  type Strength,
  strengthLabels,
} from "@/lib/auth/passwords";
import { cn } from "@/lib/utils";

// A password with a show/hide button and a Caps Lock warning. autoComplete tells password
// managers whether to fill ("current-password") or suggest a new one ("new-password"); pasting
// is always allowed (password managers). A new password (`meter`) shows its strength in text on
// the label's line and a thin three-part bar under the field (E27); the pills of what counts
// (PasswordChecklist) go under the field or the pair of fields. A field with `note` keeps a
// line under it for its quiet note ("As senhas são iguais"), so nothing jumps when it shows.

export function PasswordField({
  id: given,
  label,
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
  describedBy,
  feedback,
  meter,
  note = false,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  autoComplete: "current-password" | "new-password";
  /** The checklist's id, when it describes this field. */
  describedBy?: string;
  /** A quiet note under the field when there is no error (e.g. "As senhas são iguais"). */
  feedback?: { text: string; ok: boolean } | null;
  /** A new password: its strength beside the label and the bar under the field. */
  meter?: PasswordOwner;
  /** Keep the line under the field for `feedback`, shown or not (no layout shift). */
  note?: boolean;
}) {
  const generated = useId();
  const id = given ?? generated;
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const errorId = `${id}-erro`;
  const capsId = `${id}-caps`;
  const feedbackId = `${id}-nota`;
  const describes =
    [error && errorId, !error && feedback && feedbackId, capsLock && capsId, describedBy]
      .filter(Boolean)
      .join(" ") || undefined;
  const readCaps = (event: React.KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState?.("CapsLock") ?? false);
  return (
    <div className="grid content-start gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.9375rem] font-semibold">
          {label}
        </label>
        {meter && <StrengthLabel value={value} owner={meter} />}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={readCaps}
          onKeyUp={readCaps}
          onBlur={() => {
            setCapsLock(false);
            onBlur?.();
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describes}
          className="pr-14"
        />
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={visible ? "Esconder a senha" : "Mostrar a senha"}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-leaf"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-5" />
          ) : (
            <Eye aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>
      {meter && <StrengthBar value={value} owner={meter} />}
      {/* The error first, right under the field (proximity); then the quiet notes. */}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!error && (feedback || note) && (
        <p
          id={feedbackId}
          className={cn(
            "flex min-h-5 items-center gap-1.5 text-sm",
            feedback?.ok ? "text-leaf-deep" : "text-destructive",
          )}
        >
          {feedback?.ok && <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />}
          {feedback?.text}
        </p>
      )}
      {capsLock && (
        <p id={capsId} role="status" className="text-sm font-semibold text-ink">
          Caps Lock está ligado.
        </p>
      )}
    </div>
  );
}

const meterSteps: Record<Strength, number> = { weak: 1, good: 2, strong: 3 };

/**
 * "Força: Fraca / Boa / Forte" on the label's line, in text (never only colour). Screen readers
 * hear it when the level changes (aria-live, polite), never on each key.
 */
function StrengthLabel({ value, owner }: { value: string; owner: PasswordOwner }) {
  const strength = passwordStrength(value, owner);
  return (
    <span aria-live="polite" className="text-sm text-ink-soft">
      Força:{" "}
      <span
        className={cn(
          "font-semibold",
          !value ? "text-ink-soft" : strength === "weak" ? "text-amber-800" : "text-leaf-deep",
        )}
      >
        {value ? strengthLabels[strength] : "—"}
      </span>
    </span>
  );
}

/** A thin bar of three parts under the field, filled by level (the label says it in text). */
function StrengthBar({ value, owner }: { value: string; owner: PasswordOwner }) {
  const strength = passwordStrength(value, owner);
  return (
    <div className="flex gap-1" aria-hidden="true">
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-200",
            value && step <= meterSteps[strength]
              ? strength === "weak"
                ? "bg-amber-600"
                : "bg-leaf"
              : "bg-line",
          )}
        />
      ))}
    </div>
  );
}

/** One small pill: a check once it counts, a quiet dash before; the text always says it. */
function Pill({ met, label }: { met: boolean; label: string }) {
  return (
    <li
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[0.8125rem] leading-none transition-colors duration-200",
        met ? "border-leaf/35 bg-leaf-wash text-leaf-deep" : "border-line bg-paper text-ink-soft",
      )}
    >
      {met ? (
        <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.75} />
      ) : (
        <Minus aria-hidden="true" className="size-3 shrink-0 opacity-70" strokeWidth={2.5} />
      )}
      <span className="sr-only">{met ? "Feito: " : "Ainda não: "}</span>
      {label}
    </li>
  );
}

/**
 * What counts (E27, owner's decision): 8 characters is the one requirement; lowercase,
 * uppercase, a number and a symbol only make the password stronger. Small pills in one line
 * (two when the card is narrow), green with a check once met.
 */
export function PasswordChecklist({ id, value }: { id: string; value: string }) {
  return (
    <div id={id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <ul aria-label="A senha precisa ter" className="flex">
        <Pill met={lengthRequirement.test(value)} label={lengthRequirement.label} />
      </ul>
      <span className="text-[0.8125rem] text-ink-soft">Mais forte com:</span>
      <ul aria-label="Deixa a senha mais forte" className="flex flex-wrap gap-1.5">
        {passwordHints.map((hint) => (
          <Pill key={hint.id} met={hint.test(value)} label={hint.label} />
        ))}
      </ul>
    </div>
  );
}
