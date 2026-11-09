"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/components/account/api";
import { Captcha } from "@/components/account/captcha";
import { Field, FormError } from "@/components/account/field";
import { PasswordField } from "@/components/account/password-field";
import { ResendConfirmation } from "@/components/account/resend-confirmation";
import { Button } from "@/components/ui/button";
import { safeNextPath } from "@/lib/supabase/env";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("voltar"));
  const back = params.get("voltar") ? `?voltar=${encodeURIComponent(next)}` : "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(
    params.get("erro") === "link"
      ? "Esse link expirou ou já foi usado. Entre de novo abaixo."
      : null,
  );
  const [unconfirmed, setUnconfirmed] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setFields({});
    setUnconfirmed(false);
    const result = await postJson<{ next?: string }>("/api/auth/sign-in", {
      email,
      password,
      captchaToken: captcha,
      next,
    });
    setSending(false);
    setAttempt((count) => count + 1);
    if (result.ok) {
      router.replace(safeNextPath((result.data as { next?: string }).next, next));
      router.refresh();
      return;
    }
    setFields(result.data.fields ?? {});
    setError(result.data.error ?? "Não foi possível entrar agora. Tente de novo em instantes.");
    setUnconfirmed(Boolean((result.data as { unconfirmed?: boolean }).unconfirmed));
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <header className="grid gap-3">
        <h1 className="font-display text-[2.5rem] leading-[1.05]">Entre na sua conta</h1>
        <p className="text-[1.0625rem] text-ink-soft">
          Suas respostas e sites ficam guardados aqui.
        </p>
      </header>

      <FormError message={error} />
      {unconfirmed && <ResendConfirmation email={email} next={next} />}

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
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        error={fields.password}
      />
      <Captcha onToken={setCaptcha} resetKey={attempt} />
      {fields.captcha && <p className="text-sm text-destructive">{fields.captcha}</p>}

      <Button
        aria-busy={sending || undefined}
        type="submit"
        size="lg"
        disabled={sending}
        className="group"
      >
        {sending ? "Entrando…" : "Entrar"}
        <ArrowRight
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </Button>

      {/* After the button (E26): the header's "Entrar ou cadastre-se" already leads here, and
          signing up is one tap away. 24px apart, each keeps its own 44px area (Fitts). */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-6 text-[0.9375rem]">
        <p className="text-ink-soft">
          Ainda não tem conta?{" "}
          <Link
            href={`/cadastro${back}`}
            className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
          >
            Cadastre-se
          </Link>
        </p>
        <Link
          href={`/esqueci-senha${back}`}
          className="touch-target text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          Esqueci a senha
        </Link>
      </div>
    </form>
  );
}
