"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formErrorOf, postJson } from "@/components/account/api";
import { Captcha } from "@/components/account/captcha";
import { Field, FormError } from "@/components/account/field";
import { PasswordField } from "@/components/account/password-field";
import { ResendConfirmation } from "@/components/account/resend-confirmation";
import { Button } from "@/components/ui/button";
import { announceNavigation } from "@/lib/navigation";
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
  // E26: after a successful sign-in the button keeps saying "Entrando…" until the next page is
  // on screen (no blank moment), and that page starts loading as soon as the password is typed.
  const [entering, startEntering] = useTransition();
  const warmed = useRef(false);
  const warmUp = () => {
    if (warmed.current) return;
    warmed.current = true;
    router.prefetch(next);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending || entering) return;
    warmUp();
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
      announceNavigation();
      startEntering(() => {
        router.replace(safeNextPath((result.data as { next?: string }).next, next));
        router.refresh();
      });
      return;
    }
    setFields(result.data.fields ?? {});
    setError(
      formErrorOf(result.data, "Não foi possível entrar agora. Tente de novo em instantes."),
    );
    setUnconfirmed(Boolean((result.data as { unconfirmed?: boolean }).unconfirmed));
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-7">
      <header className="grid gap-2">
        <h1 className="font-display text-[2rem] leading-[1.1]">Entre na sua conta</h1>
        <p className="text-[1.0625rem] text-ink-soft">
          Suas respostas e sites ficam guardados aqui.
        </p>
        {/* Owner's request (E27): back to the note on top. The header's "Entrar ou
            cadastre-se" leads here, so signing up is one tap away, before the fields. */}
        <p className="mt-2 rounded-lg border border-leaf/30 bg-leaf/5 px-4 py-3 text-[0.9375rem]">
          Ainda não tem conta?{" "}
          <Link
            href={`/cadastro${back}`}
            className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
          >
            Cadastre-se
          </Link>
        </p>
      </header>

      {/* After a reset (E30): every session ended, so the person signs in with the new one. */}
      {params.get("senha") === "alterada" && !error && (
        <p
          role="status"
          className="rounded-lg border border-leaf/30 bg-leaf-wash p-3 text-sm font-semibold text-leaf-deep"
        >
          Senha alterada. Entre com a nova senha.
        </p>
      )}
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
        onChange={(value) => {
          setPassword(value);
          if (value) warmUp();
        }}
        error={fields.password}
      />
      <Captcha onToken={setCaptcha} resetKey={attempt} />
      {fields.captcha && <p className="text-sm text-destructive">{fields.captcha}</p>}

      <Button
        aria-busy={sending || entering || undefined}
        type="submit"
        size="lg"
        className="group"
      >
        {sending || entering ? "Entrando…" : "Entrar"}
        <ArrowRight
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </Button>

      <Link
        href={`/esqueci-senha${back}`}
        className="touch-target justify-self-start text-[0.9375rem] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
      >
        Esqueci a senha
      </Link>
    </form>
  );
}
