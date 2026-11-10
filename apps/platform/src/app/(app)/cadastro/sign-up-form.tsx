"use client";

import { ArrowRight, MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { postJson } from "@/components/account/api";
import { Captcha } from "@/components/account/captcha";
import { Field, FormError } from "@/components/account/field";
import { PasswordChecklist, PasswordField } from "@/components/account/password-field";
import { ResendConfirmation } from "@/components/account/resend-confirmation";
import { Button } from "@/components/ui/button";
import { suggestEmail } from "@/lib/auth/email-typos";
import { passwordProblem } from "@/lib/auth/passwords";
import { emailSchema, fieldErrors, fullNameSchema, signUpSchema } from "@/lib/auth/schemas";
import { safeNextPath } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

// Signing up (E15, E26): name and email, then the password and its confirmation, side by side
// from 768px, with the checklist of the five rules under both. Name and email are checked when
// the person leaves the field, not on every key; the button is never disabled: sending with
// something wrong lists what to fix at the top and moves focus to the first field.

const ids = {
  fullName: "cadastro-nome",
  email: "cadastro-email",
  password: "cadastro-senha",
  confirmPassword: "cadastro-repita",
  acceptTerms: "cadastro-termos",
} as const;

/** The terms' links inside the sentence: a fine underline, never heavy (E27). */
const inlineLink =
  "touch-target font-medium text-leaf-deep underline decoration-1 underline-offset-[3px] hover:decoration-2";

/** The fields in the form's order: the first one with an error gets the focus. */
const order: [key: string, id: string][] = [
  ["fullName", ids.fullName],
  ["email", ids.email],
  ["password", ids.password],
  ["confirmPassword", ids.confirmPassword],
  ["acceptTerms", ids.acceptTerms],
];

export function SignUpForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("voltar"));
  const back = params.get("voltar") ? `?voltar=${encodeURIComponent(next)}` : "";
  const termsErrorId = useId();
  const checklistId = useId();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [captcha, setCaptcha] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const setField = (key: string, message: string | undefined) =>
    setFields((current) => {
      const { [key]: _, ...rest } = current;
      return message ? { ...rest, [key]: message } : rest;
    });

  // The confirmation speaks once the person left it or typed as much as the password, and the
  // password itself meets the rules: never while they are still typing.
  const confirmReady = confirm.length > 0 && (confirmTouched || confirm.length >= password.length);
  const matches = confirm === password;
  const confirmFeedback =
    confirmReady && !passwordProblem(password)
      ? matches
        ? { text: "As senhas são iguais.", ok: true }
        : { text: "As senhas não são iguais.", ok: false }
      : null;

  // Each error once, under its own field (E29: no summary repeating them at the top). Focus goes
  // to the first one, whose error is read with it; each error is also announced (role="alert").
  function showErrors(found: Record<string, string>) {
    setFields(found);
    const first = order.find(([key]) => found[key]);
    if (first) document.getElementById(first[1])?.focus();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    setError(null);
    // Checked here first, so every field's problem shows at once; the server checks it all again.
    const checked = signUpSchema.safeParse({
      fullName,
      email,
      password,
      confirmPassword: confirm,
      acceptTerms: accepted,
    });
    if (!checked.success) {
      showErrors(fieldErrors(checked.error));
      return;
    }
    setSending(true);
    setFields({});
    const result = await postJson("/api/auth/sign-up", {
      fullName,
      email,
      password,
      confirmPassword: confirm,
      acceptTerms: accepted,
      captchaToken: captcha,
      next,
    });
    setSending(false);
    setAttempt((count) => count + 1);
    if (result.ok) {
      setSent(true);
      return;
    }
    if (result.data.fields && Object.keys(result.data.fields).length) {
      // The fields say what to fix: no general message on top repeating it.
      showErrors(result.data.fields);
      return;
    }
    setError(
      result.data.error ?? "Não foi possível criar a conta agora. Tente de novo em instantes.",
    );
  }

  if (sent) {
    return (
      <section aria-live="polite" className="grid gap-4">
        <MailCheck aria-hidden="true" className="size-9 text-leaf" strokeWidth={1.6} />
        <h1 className="font-display text-[2rem] leading-[1.1]">Confira o seu e-mail</h1>
        <p className="text-[1.0625rem] text-ink-soft">
          Enviamos um link de confirmação para{" "}
          <strong className="font-semibold text-ink">{email.trim()}</strong>. Toque nele para
          entrar. Não achou? Veja o spam.
        </p>
        <ResendConfirmation email={email} next={next} />
        <Button
          type="button"
          variant="ghost"
          className="justify-self-start px-0 text-leaf-deep hover:bg-transparent hover:underline"
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
        >
          Usar outro e-mail
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-7">
      <header className="grid gap-2 [@media(max-height:700px)]:gap-1">
        <h1 className="font-display text-[2rem] leading-[1.1]">Crie a sua conta</h1>
        <p className="text-[1.0625rem] text-ink-soft">É grátis. Seus sites ficam guardados nela.</p>
      </header>

      <FormError message={error} />

      {/* Two columns from 768px: name and email, then the password (with its minimum) and its
          repetition (E27, E30). */}
      <div className="grid gap-5 md:grid-cols-2 md:gap-x-6">
        <Field
          id={ids.fullName}
          label="Seu nome"
          autoComplete="name"
          autoCapitalize="words"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          onBlur={() => {
            if (!fullName) return;
            const parsed = fullNameSchema.safeParse(fullName);
            setField("fullName", parsed.success ? undefined : parsed.error.issues[0]?.message);
          }}
          error={fields.fullName}
        />
        <div className="grid content-start gap-2">
          <Field
            id={ids.email}
            label="E-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSuggestion(null);
            }}
            onBlur={() => {
              if (!email) return;
              const parsed = emailSchema.safeParse(email);
              setField("email", parsed.success ? undefined : parsed.error.issues[0]?.message);
              setSuggestion(parsed.success ? suggestEmail(email) : null);
            }}
            error={fields.email}
          />
          {suggestion && (
            <p className="text-sm text-ink-soft" role="status">
              Você quis dizer{" "}
              <button
                type="button"
                onClick={() => {
                  setEmail(suggestion);
                  setSuggestion(null);
                  setField("email", undefined);
                }}
                className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
              >
                {suggestion}
              </button>
              ?
            </p>
          )}
        </div>
        {/* The minimum right under the password it is about (E30), not across both columns. */}
        <div className="grid content-start gap-2">
          <PasswordField
            id={ids.password}
            label="Senha"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            describedBy={checklistId}
            meter={{ email, name: fullName }}
            error={fields.password}
          />
          <PasswordChecklist id={checklistId} value={password} />
        </div>
        <PasswordField
          id={ids.confirmPassword}
          label="Repita a senha"
          autoComplete="new-password"
          value={confirm}
          onChange={(value) => {
            setConfirm(value);
            if (fields.confirmPassword) setField("confirmPassword", undefined);
          }}
          onBlur={() => setConfirmTouched(true)}
          feedback={confirmFeedback}
          note
          error={fields.confirmPassword}
        />
      </div>

      <Captcha onToken={setCaptcha} resetKey={attempt} />
      {fields.captcha && <p className="text-sm text-destructive">{fields.captcha}</p>}

      {/* The card's footer (E30): the terms in one sentence (one line on the 40rem card), the
          button across the card like "Entrar" on sign-in, then "Já tem conta? Entrar". */}
      <div className="grid gap-5 border-t border-line pt-6 [@media(max-height:700px)]:gap-3 [@media(max-height:700px)]:pt-4">
        <div className="grid gap-2">
          <div className="flex items-start gap-3">
            <input
              id={ids.acceptTerms}
              type="checkbox"
              checked={accepted}
              onChange={(event) => {
                setAccepted(event.target.checked);
                if (event.target.checked) setField("acceptTerms", undefined);
              }}
              aria-invalid={fields.acceptTerms ? true : undefined}
              aria-describedby={fields.acceptTerms ? termsErrorId : undefined}
              className="mt-px size-5 shrink-0 accent-leaf"
            />
            {/* A normal line height (E30); each link's 44px tap area comes from touch-target,
                not from tall lines. Link names never break in the middle. */}
            <label htmlFor={ids.acceptTerms} className="text-[0.9375rem] leading-[1.45]">
              Li e aceito os{" "}
              <Link href="/termos" target="_blank" className={cn(inlineLink, "whitespace-nowrap")}>
                Termos de uso
              </Link>{" "}
              {/* "e a" travels with the second link: never alone at the end of a line (E29). */}
              <span className="whitespace-nowrap">
                e a{" "}
                <Link href="/privacidade" target="_blank" className={inlineLink}>
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>
          </div>
          {fields.acceptTerms && (
            <p id={termsErrorId} role="alert" className="text-sm text-destructive">
              {fields.acceptTerms}
            </p>
          )}
        </div>
        <Button aria-busy={sending || undefined} type="submit" size="lg" className="group w-full">
          {sending ? "Criando…" : "Criar conta"}
          <ArrowRight
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </Button>
        <p className="text-sm text-ink-soft">
          Já tem conta?{" "}
          <Link
            href={`/entrar${back}`}
            className="touch-target font-semibold text-leaf-deep underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </form>
  );
}
