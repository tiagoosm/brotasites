"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { postJson } from "@/components/account/api";
import { AuthShell } from "@/components/account/auth-shell";
import { Captcha } from "@/components/account/captcha";
import { Field, FormError } from "@/components/account/field";
import { Button } from "@/components/ui/button";

// "Esqueci a senha": a link by email that signs in and leads to /redefinir-senha.
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
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
    const result = await postJson("/api/auth/recover", { email, captchaToken: captcha });
    setSending(false);
    setAttempt((count) => count + 1);
    if (result.ok) {
      setSent(true);
      return;
    }
    setFields(result.data.fields ?? {});
    setError(result.data.error ?? "Não foi possível enviar agora. Tente de novo em instantes.");
  }

  return (
    <AuthShell>
      {sent ? (
        <section aria-live="polite" className="grid gap-4">
          <MailCheck aria-hidden="true" className="size-9 text-leaf" strokeWidth={1.6} />
          <h1 className="font-display text-[2.5rem] leading-[1.05]">Confira o seu e-mail</h1>
          <p className="text-[1.0625rem] text-ink-soft">
            Se houver uma conta com{" "}
            <strong className="font-semibold text-ink">{email.trim()}</strong>, enviamos um link
            para criar uma nova senha. O link vale por pouco tempo e só uma vez.
          </p>
          <Link
            href="/entrar"
            className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
          >
            Voltar para entrar
          </Link>
        </section>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-6">
          <header className="grid gap-3">
            <h1 className="font-display text-[2.5rem] leading-[1.05]">Esqueceu a senha?</h1>
            <p className="text-[1.0625rem] text-ink-soft">
              Escreva o e-mail da sua conta. Mandamos um link para você criar uma nova senha.
            </p>
          </header>
          <FormError message={error} />
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
          <Captcha onToken={setCaptcha} resetKey={attempt} />
          {fields.captcha && <p className="text-sm text-destructive">{fields.captcha}</p>}
          <Button type="submit" size="lg" disabled={sending}>
            {sending ? "Enviando…" : "Enviar link"}
          </Button>
          <Link
            href="/entrar"
            className="touch-target justify-self-start text-[0.9375rem] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Voltar para entrar
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
