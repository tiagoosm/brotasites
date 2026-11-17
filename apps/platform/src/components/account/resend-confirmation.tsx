"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { postJson } from "./api";
import { Captcha, useCaptcha } from "./captcha";

const WAIT = 60;

// "Reenviar e-mail de confirmação": once a minute at most (Supabase waits 60 s too). E44: it
// goes through the CAPTCHA like the other account routes; before E44 it sent no token at all,
// so with Turnstile on it was always refused with "não é um robô".
export function ResendConfirmation({ email, next }: { email: string; next?: string }) {
  const [until, setUntil] = useState(() => Date.now() + WAIT * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const captcha = useCaptcha();
  const wait = Math.max(0, Math.ceil((until - now) / 1000));

  // One interval against a deadline: the count stays right even when the tab sleeps.
  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);

  async function resend() {
    if (captcha.waiting) return;
    const current = Date.now();
    setNow(current);
    setUntil(current + WAIT * 1000);
    const result = await postJson("/api/auth/resend", {
      email,
      next,
      captchaToken: captcha.token,
    });
    captcha.reset();
    setMessage(
      result.ok
        ? "Se houver uma conta esperando confirmação, enviamos um novo link."
        : (result.data.error ?? "Não foi possível reenviar agora."),
    );
  }

  return (
    <div className="grid gap-2">
      <Captcha {...captcha.props} />
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={wait > 0 || captcha.waiting}
        onClick={resend}
        // The countdown stays readable (AA) while the button waits.
        className="justify-self-start disabled:text-ink-soft disabled:opacity-100"
      >
        {wait > 0 ? `Reenviar e-mail de confirmação (${wait} s)` : "Reenviar e-mail de confirmação"}
      </Button>
      <p aria-live="polite" className="text-sm text-ink-soft">
        {message}
      </p>
    </div>
  );
}
