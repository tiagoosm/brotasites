"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { formErrorOf, postJson } from "@/components/account/api";
import { AuthShell } from "@/components/account/auth-shell";
import { FormError } from "@/components/account/field";
import { PasswordChecklist, PasswordField } from "@/components/account/password-field";
import { Loading } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { passwordProblem } from "@/lib/auth/passwords";
import { PASSWORDS_DIFFER } from "@/lib/auth/schemas";
import { getBrowserSupabase } from "@/lib/supabase/client";

// After the "Esqueci a senha" link: a new password, in a restricted recovery session (E30,
// lib/auth/recovery.ts) that only reaches this page. Saving ends every session, this one too,
// and leads to sign in with the new password.
export function ResetPasswordForm() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [sending, setSending] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const checklistId = useId();

  // Leaving without a new password ends the recovery session (E30): a page load is caught by
  // the proxy; a move inside the app (a header link) is caught here.
  const saved = useRef(false);
  useEffect(() => {
    const mountedAt = Date.now();
    return () => {
      // React's development double mount unmounts at once; a person leaving takes longer.
      if (saved.current || Date.now() - mountedAt < 300) return;
      const form = new FormData();
      form.set("escopo", "local");
      void fetch("/auth/sair", { method: "POST", body: form, keepalive: true }).catch(() => {});
    };
  }, []);

  useEffect(() => {
    getBrowserSupabase()
      ?.auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null)) ?? setEmail(null);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    const problem = passwordProblem(password);
    if (problem || password !== repeat) {
      setFields({
        ...(problem ? { password: problem } : {}),
        ...(password !== repeat ? { confirmPassword: PASSWORDS_DIFFER } : {}),
      });
      document.getElementById(problem ? "nova-senha" : "repita-nova-senha")?.focus();
      return;
    }
    setSending(true);
    setError(null);
    setFields({});
    const result = await postJson("/api/account/password", { password, confirmPassword: repeat });
    setSending(false);
    if (result.ok) {
      saved.current = true;
      // Every session ended with the change (E30): sign in again with the new password. A full
      // load, so nothing of the recovery session stays in this page's memory.
      window.location.assign("/entrar?senha=alterada");
      return;
    }
    setFields(result.data.fields ?? {});
    setError(
      result.data.reauth
        ? "Este link já não vale. Peça um novo em Esqueci a senha."
        : formErrorOf(result.data, "Não foi possível trocar a senha agora."),
    );
  }

  if (email === undefined) return <Loading />;
  return (
    <AuthShell>
      {email === null ? (
        <section className="grid gap-4">
          <h1 className="font-display text-[2rem] leading-[1.1]">Link expirado</h1>
          <p className="text-[1.0625rem] text-ink-soft">
            Este link de redefinição já foi usado ou expirou. Peça um novo.
          </p>
          <Link
            href="/esqueci-senha"
            className="touch-target font-semibold text-leaf-deep underline underline-offset-4"
          >
            Pedir um novo link
          </Link>
        </section>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-7">
          <header className="grid gap-2">
            <h1 className="font-display text-[2rem] leading-[1.1]">Crie uma nova senha</h1>
            <p className="text-[1.0625rem] text-ink-soft">
              Para a conta <strong className="font-semibold text-ink">{email}</strong>. Os outros
              aparelhos vão precisar entrar de novo.
            </p>
          </header>
          <FormError message={error} />
          {/* For password managers: the account this password belongs to. */}
          <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
          <PasswordField
            id="nova-senha"
            label="Nova senha"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            describedBy={checklistId}
            meter={{ email }}
            error={fields.password}
          />
          <PasswordField
            id="repita-nova-senha"
            label="Repita a nova senha"
            autoComplete="new-password"
            value={repeat}
            onChange={setRepeat}
            error={fields.confirmPassword}
          />
          <PasswordChecklist id={checklistId} value={password} />
          <Button aria-busy={sending || undefined} type="submit" size="lg">
            {sending ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
