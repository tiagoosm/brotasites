"use client";

import { ArrowRight, MailCheck } from "lucide-react";
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

type Mode = "password" | "link" | "link-sent";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("voltar"));
  const back = params.get("voltar") ? `?voltar=${encodeURIComponent(next)}` : "";

  const [mode, setMode] = useState<Mode>("password");
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
    const result =
      mode === "password"
        ? await postJson<{ next?: string }>("/api/auth/sign-in", {
            email,
            password,
            captchaToken: captcha,
            next,
          })
        : await postJson("/api/auth/link", { email, captchaToken: captcha, next });
    setSending(false);
    setAttempt((count) => count + 1);
    if (result.ok) {
      if (mode === "link") {
        setMode("link-sent");
        return;
      }
      router.replace(safeNextPath((result.data as { next?: string }).next, next));
      router.refresh();
      return;
    }
    setFields(result.data.fields ?? {});
    setError(result.data.error ?? "Não foi possível entrar agora. Tente de novo em instantes.");
    setUnconfirmed(Boolean((result.data as { unconfirmed?: boolean }).unconfirmed));
  }

  if (mode === "link-sent") {
    return (
      <section aria-live="polite" className="grid gap-4">
        <MailCheck aria-hidden="true" className="size-9 text-leaf" strokeWidth={1.6} />
        <h1 className="font-display text-[2.5rem] leading-[1.05]">Confira o seu e-mail</h1>
        <p className="text-[1.0625rem] text-ink-soft">
          Se houver uma conta com <strong className="font-semibold text-ink">{email.trim()}</strong>
          , enviamos um link de acesso. Abra o e-mail e toque no link para continuar.
        </p>
        <Button
          type="button"
          variant="ghost"
          className="mt-2 justify-self-start px-0 text-leaf-deep hover:bg-transparent hover:underline"
          onClick={() => setMode("link")}
        >
          Usar outro e-mail
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <header className="grid gap-3">
        <h1 className="font-display text-[2.5rem] leading-[1.05]">Entre na sua conta</h1>
        <p className="text-[1.0625rem] text-ink-soft">
          {mode === "password"
            ? "Suas respostas e os seus sites ficam guardados na sua conta."
            : "Mandamos um link de acesso para o seu e-mail. Toque nele para entrar."}
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
      {mode === "password" && (
        <PasswordField
          label="Senha"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={fields.password}
        />
      )}
      <Captcha onToken={setCaptcha} resetKey={attempt} />
      {fields.captcha && <p className="text-sm text-destructive">{fields.captcha}</p>}

      <Button type="submit" size="lg" disabled={sending} className="group">
        {sending ? "Enviando…" : mode === "password" ? "Entrar" : "Enviar link de acesso"}
        <ArrowRight
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </Button>

      <div className="grid gap-1 text-[0.9375rem]">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "password" ? "link" : "password");
            setError(null);
            setFields({});
          }}
          className="touch-target justify-self-start font-semibold text-leaf-deep underline-offset-4 hover:underline"
        >
          {mode === "password" ? "Entrar com um link no e-mail" : "Entrar com a senha"}
        </button>
        <Link
          href={`/esqueci-senha${back}`}
          className="touch-target justify-self-start text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          Esqueci a senha
        </Link>
        <p className="text-ink-soft">
          Ainda não tem conta?{" "}
          <Link
            href={`/cadastro${back}`}
            className="touch-target font-semibold text-leaf-deep underline-offset-4 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </form>
  );
}
