"use client";

import { ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { formErrorOf, postJson } from "@/components/account/api";
import { Captcha } from "@/components/account/captcha";
import { Field, FormError } from "@/components/account/field";
import { PasswordField } from "@/components/account/password-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { teamNextPath } from "@/lib/auth/team";
import { announceNavigation } from "@/lib/navigation";
import { PLATFORM_URL } from "@/lib/site-url";
import { getBrowserSupabase } from "@/lib/supabase/client";

// The team's sign-in form (E33). The same sign-in route as the clients' (rate limits, origin,
// captcha when on), then a check that the account is on the team: if it is not, the session is
// ended at once (it never stays open on the team's host) and the page says so. It goes back
// only to a page of /admin. With the team's switch on (team_settings), the route answers with
// the code step first, as before.

type Outcome = "form" | "checking" | "denied";

export function TeamSignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = teamNextPath(params.get("voltar"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("form");
  const [entering, startEntering] = useTransition();
  const checked = useRef(false);

  // On the team or not: in, or out at once.
  const admit = useCallback(async (target: string) => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("Não foi possível entrar agora. Tente de novo em instantes.");
      return;
    }
    setOutcome("checking");
    const { data } = await supabase.rpc("is_admin_member");
    if (data === true) {
      // A full load: the router may hold /admin from before the sign-in (a redirect back here).
      announceNavigation();
      window.location.assign(target);
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    setOutcome("denied");
  }, []);

  // Already signed in on this host (a stale tab, the back button): the same check.
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) admit(next).catch(() => setOutcome("form"));
    });
  }, [admit, next]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending || entering) return;
    setSending(true);
    setError(null);
    setFields({});
    const result = await postJson<{ next?: string }>("/api/auth/sign-in", {
      email,
      password,
      captchaToken: captcha,
      next,
    });
    setSending(false);
    setAttempt((count) => count + 1);
    if (!result.ok) {
      setFields(result.data.fields ?? {});
      setError(
        formErrorOf(result.data, "Não foi possível entrar agora. Tente de novo em instantes."),
      );
      return;
    }
    const answer = (result.data as { next?: string }).next ?? next;
    // The code step, only while the team's switch asks for it.
    if (answer.startsWith("/entrar/verificacao")) {
      announceNavigation();
      startEntering(() => router.replace(answer));
      return;
    }
    await admit(teamNextPath(answer)).catch(() => {
      setOutcome("form");
      setError("Não foi possível entrar agora. Tente de novo em instantes.");
    });
  }

  if (outcome === "denied") {
    return (
      <section aria-labelledby="sem-acesso" className="grid gap-6">
        <header className="grid gap-2">
          <h1 id="sem-acesso" className="font-display text-[2rem] leading-[1.1]">
            Sem acesso
          </h1>
          <p role="alert" className="text-[1.0625rem] text-ink-soft">
            Esta conta não tem acesso à área da equipe.
          </p>
          <p className="text-[0.9375rem] text-ink-soft">Você saiu desta conta aqui.</p>
        </header>
        <div className="grid gap-3">
          <Button
            type="button"
            size="lg"
            onClick={() => {
              setOutcome("form");
              setPassword("");
            }}
          >
            Entrar com outra conta
          </Button>
          <a href={PLATFORM_URL} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Ir para o site
          </a>
        </div>
      </section>
    );
  }

  const busy = sending || entering || outcome === "checking";
  return (
    <form onSubmit={submit} noValidate className="grid gap-7">
      <header className="grid gap-2">
        <h1 className="font-display text-[2rem] leading-[1.1]">Área da equipe</h1>
        <p className="text-[1.0625rem] text-ink-soft">
          Entre com o e-mail e a senha da sua conta de equipe.
        </p>
      </header>

      <FormError message={error} />

      <Field
        label="E-mail"
        type="email"
        inputMode="email"
        autoComplete="username"
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

      <Button aria-busy={busy || undefined} type="submit" size="lg" className="group w-full">
        {busy ? "Entrando…" : "Entrar"}
        <ArrowRight
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </Button>

      <p className="text-[0.875rem] text-ink-soft">
        Esqueceu a senha? Redefina no{" "}
        <a
          href={`${PLATFORM_URL}/esqueci-senha`}
          className="touch-target relative font-semibold text-leaf-deep underline underline-offset-4"
        >
          site da BrotaSites
        </a>
        .
      </p>
    </form>
  );
}
