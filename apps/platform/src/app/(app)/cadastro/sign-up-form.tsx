"use client";

import { ArrowRight, MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { postJson } from "@/components/account/api";
import { Captcha } from "@/components/account/captcha";
import { Field, FormError } from "@/components/account/field";
import { PasswordField } from "@/components/account/password-field";
import { ResendConfirmation } from "@/components/account/resend-confirmation";
import { Button } from "@/components/ui/button";
import { safeNextPath } from "@/lib/supabase/env";

export function SignUpForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("voltar"));
  const back = params.get("voltar") ? `?voltar=${encodeURIComponent(next)}` : "";
  const termsId = useId();
  const termsErrorId = useId();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [captcha, setCaptcha] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setFields({});
    const result = await postJson("/api/auth/sign-up", {
      fullName,
      email,
      password,
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
    setFields(result.data.fields ?? {});
    setError(
      result.data.error ?? "Não foi possível criar a conta agora. Tente de novo em instantes.",
    );
  }

  if (sent) {
    return (
      <section aria-live="polite" className="grid gap-4">
        <MailCheck aria-hidden="true" className="size-9 text-leaf" strokeWidth={1.6} />
        <h1 className="font-display text-[2.5rem] leading-[1.05]">Confira o seu e-mail</h1>
        <p className="text-[1.0625rem] text-ink-soft">
          Enviamos um link de confirmação para{" "}
          <strong className="font-semibold text-ink">{email.trim()}</strong>. Toque nele para
          confirmar o e-mail e entrar. Se não encontrar, olhe também a caixa de spam.
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
    <form onSubmit={submit} noValidate className="grid gap-6">
      <header className="grid gap-3">
        <h1 className="font-display text-[2.5rem] leading-[1.05]">Crie a sua conta</h1>
        <p className="text-[1.0625rem] text-ink-soft">
          É grátis. Suas respostas e os seus sites ficam guardados na sua conta.
        </p>
      </header>

      <FormError message={error} />

      <Field
        label="Seu nome"
        autoComplete="name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        error={fields.fullName}
      />
      <Field
        label="E-mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="voce@exemplo.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fields.email}
      />
      <PasswordField
        label="Senha"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        email={email}
        meter
        error={fields.password}
      />

      <div className="grid gap-1.5">
        <div className="flex items-start gap-3">
          <input
            id={termsId}
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            aria-invalid={fields.acceptTerms ? true : undefined}
            aria-describedby={fields.acceptTerms ? termsErrorId : undefined}
            className="mt-0.5 size-6 shrink-0 accent-leaf"
          />
          <label htmlFor={termsId} className="text-[0.9375rem]">
            Li e aceito os{" "}
            <Link
              href="/termos"
              target="_blank"
              className="font-semibold text-leaf-deep underline underline-offset-4"
            >
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link
              href="/privacidade"
              target="_blank"
              className="font-semibold text-leaf-deep underline underline-offset-4"
            >
              Política de Privacidade
            </Link>
            .
          </label>
        </div>
        {fields.acceptTerms && (
          <p id={termsErrorId} className="text-sm text-destructive">
            {fields.acceptTerms}
          </p>
        )}
      </div>

      <Captcha onToken={setCaptcha} resetKey={attempt} />
      {fields.captcha && <p className="text-sm text-destructive">{fields.captcha}</p>}

      <Button type="submit" size="lg" disabled={sending} className="group">
        {sending ? "Criando…" : "Criar conta"}
        <ArrowRight
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </Button>

      <p className="text-[0.9375rem] text-ink-soft">
        Já tem conta?{" "}
        <Link
          href={`/entrar${back}`}
          className="touch-target font-semibold text-leaf-deep underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
