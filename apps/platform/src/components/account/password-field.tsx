"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN, passwordStrength, strengthLabels } from "@/lib/auth/passwords";

// A password with a show/hide button and, for new passwords, the rule and a simple meter.
// autoComplete tells password managers whether to fill ("current-password") or suggest a
// new one ("new-password").

export function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete,
  email,
  meter = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: "current-password" | "new-password";
  email?: string;
  meter?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const hintId = `${id}-dica`;
  const errorId = `${id}-erro`;
  const strength = passwordStrength(value, email);
  const describedBy = [meter && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
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
      {meter && (
        <div id={hintId} className="grid gap-1.5 text-sm text-ink-soft">
          <p>Pelo menos {PASSWORD_MIN} caracteres. Evite senhas comuns e o seu e-mail.</p>
          {value && (
            <div className="flex items-center gap-3">
              <div className="flex flex-1 gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 flex-1 rounded-full ${step <= strength ? (strength <= 1 ? "bg-amber-600" : "bg-leaf") : "bg-border"}`}
                  />
                ))}
              </div>
              <span aria-live="polite" className="min-w-24 text-right font-semibold text-ink">
                {strengthLabels[strength]}
              </span>
            </div>
          )}
        </div>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
