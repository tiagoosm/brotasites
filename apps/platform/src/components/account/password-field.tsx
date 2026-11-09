"use client";

import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  type PasswordOwner,
  passwordRules,
  passwordStrength,
  type Strength,
  strengthLabels,
} from "@/lib/auth/passwords";
import { cn } from "@/lib/utils";

// A password with a show/hide button and a Caps Lock warning. autoComplete tells password
// managers whether to fill ("current-password") or suggest a new one ("new-password"); pasting
// is always allowed (password managers). New passwords show the checklist of the five rules and
// the meter (PasswordChecklist, below the field or the pair of fields).

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
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        {label}
      </label>
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
      {/* The error first, right under the field (proximity); then the quiet notes. */}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!error && feedback && (
        <p
          id={feedbackId}
          className={cn(
            "flex items-center gap-1.5 text-sm",
            feedback.ok ? "text-leaf-deep" : "text-destructive",
          )}
        >
          {feedback.ok && <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />}
          {feedback.text}
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
 * The five rules, each with an icon and text, updated as the person types, and the meter in
 * text ("Fraca", "Boa", "Forte"). Colour is never the only sign. Screen readers hear only the
 * summary ("Faltam 2 itens"), when it changes, never each key. Its height is fixed from the
 * start, so nothing below jumps (CLS 0).
 */
export function PasswordChecklist({
  id,
  value,
  owner,
}: {
  id: string;
  value: string;
  owner: PasswordOwner;
}) {
  const met = passwordRules.map((rule) => rule.test(value));
  const left = met.filter((ok) => !ok).length;
  const strength = passwordStrength(value, owner);
  const summary =
    left === 0
      ? `Todos os itens atendidos. Força: ${strengthLabels[strength]}.`
      : `Falta${left > 1 ? "m" : ""} ${left} ${left > 1 ? "itens" : "item"} na senha.`;
  return (
    // One wrapping row: the five rules, then the meter, so it costs as little height as it can.
    <div id={id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {/* Its items join the row (display: contents); the explicit roles keep it a list. */}
      {/* biome-ignore lint/a11y/noRedundantRoles: display: contents can drop the implicit role */}
      <ul role="list" className="contents" aria-label="A senha precisa ter">
        {passwordRules.map((rule, index) => (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-1.5",
              met[index] ? "text-leaf-deep" : "text-ink-soft",
            )}
          >
            {met[index] ? (
              <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.5} />
            ) : (
              <Circle aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
            )}
            <span>
              <span className="sr-only">{met[index] ? "Atendido: " : "Falta: "}</span>
              {rule.label}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <div className="flex w-20 gap-1" aria-hidden="true">
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                value && step <= meterSteps[strength]
                  ? strength === "weak"
                    ? "bg-amber-600"
                    : "bg-leaf"
                  : "bg-border",
              )}
            />
          ))}
        </div>
        <span className="font-semibold text-ink">
          Força: {value ? strengthLabels[strength] : "—"}
        </span>
        <span aria-live="polite" className="sr-only">
          {value ? summary : ""}
        </span>
      </div>
    </div>
  );
}
