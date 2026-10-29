"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { postJson } from "./api";

const WAIT = 60;

// "Reenviar e-mail de confirmação": once a minute at most (Supabase waits 60 s too).
export function ResendConfirmation({ email, next }: { email: string; next?: string }) {
  const [wait, setWait] = useState(WAIT);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function resend() {
    setWait(WAIT);
    const result = await postJson("/api/auth/resend", { email, next });
    setMessage(
      result.ok
        ? "Se houver uma conta esperando confirmação, enviamos um novo link."
        : (result.data.error ?? "Não foi possível reenviar agora."),
    );
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={wait > 0}
        onClick={resend}
        className="justify-self-start"
      >
        {wait > 0 ? `Reenviar e-mail de confirmação (${wait} s)` : "Reenviar e-mail de confirmação"}
      </Button>
      <p aria-live="polite" className="text-sm text-ink-soft">
        {message}
      </p>
    </div>
  );
}
