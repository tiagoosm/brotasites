"use client";

import { ArrowRight, MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/supabase/env";

type Status = "idle" | "sending" | "sent";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function errorMessage(status: number | undefined, code: string | undefined): string {
  if (status === 429 || code === "over_email_send_rate_limit") {
    return "Muitos pedidos seguidos. Espere um minuto e tente de novo.";
  }
  return "Não foi possível enviar o link agora. Tente de novo em instantes.";
}

export function SignInForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("voltar"));
  const linkFailed = params.get("erro") === "link";
  const supabase = getBrowserSupabase();
  const inputId = useId();
  const errorId = useId();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(
    linkFailed ? "Esse link expirou ou já foi usado. Peça um novo abaixo." : null,
  );

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) {
      setError("Escreva um e-mail válido, como voce@exemplo.com.");
      return;
    }
    if (!supabase) return;
    setStatus("sending");
    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: value,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    if (sendError) {
      setStatus("idle");
      setError(errorMessage(sendError.status, sendError.code));
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="step-enter w-full max-w-[26rem]">
      <div>
        <Link
          href="/"
          className="mb-14 inline-flex items-center gap-2.5 font-display text-[1.375rem] leading-none"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 text-leaf">
            <path d="M12 22V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 13C12 8 8.5 5 3 5c0 5.5 3.5 8 9 8Z" fill="currentColor" />
            <path d="M12 11c0-4.5 3-7.5 9-7.5 0 5-3 7.5-9 7.5Z" fill="currentColor" opacity=".65" />
          </svg>
          BrotaSites
        </Link>
      </div>

      {status === "sent" ? (
        <section aria-live="polite" className="grid gap-4">
          <MailCheck aria-hidden="true" className="size-9 text-leaf" strokeWidth={1.6} />
          <h1 className="font-display text-[2.5rem] leading-[1.05]">Confira o seu e-mail</h1>
          <p className="text-[1.0625rem] text-ink-soft">
            Enviamos um link para <strong className="font-semibold text-ink">{email.trim()}</strong>
            . Abra o e-mail e toque no link para continuar de onde parou.
          </p>
          <Button
            type="button"
            variant="ghost"
            className="mt-2 justify-self-start px-0 text-leaf-deep hover:bg-transparent hover:underline"
            onClick={() => setStatus("idle")}
          >
            Usar outro e-mail
          </Button>
        </section>
      ) : (
        <form onSubmit={send} noValidate className="grid gap-6">
          <header className="grid gap-3">
            <h1 className="font-display text-[2.5rem] leading-[1.05]">
              Entre para criar o seu site
            </h1>
            <p className="text-[1.0625rem] text-ink-soft">
              Mandamos um link de acesso para o seu e-mail. Sem senha para lembrar. Suas respostas e
              os seus sites ficam guardados na sua conta.
            </p>
          </header>

          {supabase ? (
            <>
              <div className="grid gap-2">
                <label htmlFor={inputId} className="text-[0.9375rem] font-semibold">
                  Seu e-mail
                </label>
                <Input
                  id={inputId}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                />
                {error && (
                  <p id={errorId} role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
              <Button type="submit" size="lg" disabled={status === "sending"} className="group">
                {status === "sending" ? "Enviando…" : "Enviar link de acesso"}
                <ArrowRight
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Button>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-ink-soft">
              O acesso por e-mail ainda não está disponível. Tente de novo mais tarde.
            </p>
          )}

          <Link
            href="/"
            className="justify-self-start text-[0.9375rem] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Voltar para o início
          </Link>
        </form>
      )}
    </div>
  );
}
