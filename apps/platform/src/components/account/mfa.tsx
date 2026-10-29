"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Field, FormError } from "@/components/account/field";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/client";

// Two-step verification with an authenticator app (TOTP, Supabase Auth MFA). Required for the
// team: /admin refuses sessions without the second step (aal2). The codes are checked by
// Supabase, which also limits attempts per IP.

const CODE = /^\d{6}$/;

function codeError(message: string | undefined): string {
  return message?.toLowerCase().includes("invalid")
    ? "Código incorreto ou vencido. Confira o aplicativo e tente de novo."
    : "Não foi possível conferir o código agora. Tente de novo.";
}

/** Asks for the 6-digit code of an enrolled app and raises the session to aal2. */
export function MfaChallenge({ onDone }: { onDone: () => void }) {
  const supabase = getBrowserSupabase();
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase?.auth.mfa.listFactors().then(({ data }) => {
      setFactorId(data?.totp.find((factor) => factor.status === "verified")?.id ?? null);
    });
  }, [supabase]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !factorId) return;
    if (!CODE.test(code)) {
      setError("Digite os 6 números que aparecem no aplicativo.");
      return;
    }
    setSending(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setSending(false);
    if (verifyError) {
      setError(codeError(verifyError.message));
      return;
    }
    onDone();
  }

  if (factorId === undefined) return null;
  if (factorId === null) return <MfaEnroll onDone={onDone} />;
  return (
    <form onSubmit={verify} noValidate className="grid gap-4">
      <FormError message={error} />
      <Field
        label="Código do aplicativo autenticador"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        hint="Abra o aplicativo (como Google Authenticator ou Authy) e digite os 6 números de BrotaSites."
      />
      <Button type="submit" size="lg" disabled={sending}>
        {sending ? "Conferindo…" : "Confirmar"}
      </Button>
    </form>
  );
}

/** Turns on the authenticator app: a QR code (or the key typed by hand), then one code. */
export function MfaEnroll({ onDone }: { onDone: () => void }) {
  const supabase = getBrowserSupabase();
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function start() {
    if (!supabase) return;
    setError(null);
    // Unfinished attempts would block a new one with the same name.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const old of list?.all.filter((item) => item.status === "unverified") ?? []) {
      await supabase.auth.mfa.unenroll({ factorId: old.id });
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `BrotaSites ${new Date().toISOString().slice(0, 10)}`,
    });
    if (enrollError || !data) {
      setError("Não foi possível começar agora. Tente de novo.");
      return;
    }
    setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !factor) return;
    if (!CODE.test(code)) {
      setError("Digite os 6 números que aparecem no aplicativo.");
      return;
    }
    setSending(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    });
    setSending(false);
    if (verifyError) {
      setError(codeError(verifyError.message));
      return;
    }
    onDone();
  }

  if (!factor) {
    return (
      <div className="grid gap-3">
        <FormError message={error} />
        <p className="text-[0.9375rem] text-ink-soft">
          Use um aplicativo autenticador no celular, como Google Authenticator, Microsoft
          Authenticator ou Authy. A cada entrada, além da senha, ele mostra um código de 6 números.
        </p>
        <Button type="button" size="lg" onClick={start} className="justify-self-start">
          <ShieldCheck aria-hidden="true" />
          Ativar a verificação em duas etapas
        </Button>
      </div>
    );
  }
  return (
    <form onSubmit={verify} noValidate className="grid gap-4">
      <FormError message={error} />
      <p className="text-[0.9375rem] text-ink-soft">
        1. No aplicativo, adicione uma conta lendo este código QR.
      </p>
      {/* The QR code comes from Supabase as an SVG data URL. */}
      {/* biome-ignore lint/performance/noImgElement: a data URL, not an optimizable image */}
      <img
        src={factor.qr}
        alt="Código QR para o aplicativo autenticador"
        width={180}
        height={180}
        className="rounded-lg border border-border bg-white p-2"
      />
      <p className="text-sm text-ink-soft">
        Não consegue ler? Digite esta chave no aplicativo:{" "}
        <code className="font-mono break-all text-ink">{factor.secret}</code>
      </p>
      <Field
        label="2. Digite o código que aparece no aplicativo"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
      />
      <Button type="submit" size="lg" disabled={sending}>
        {sending ? "Conferindo…" : "Ativar"}
      </Button>
    </form>
  );
}
