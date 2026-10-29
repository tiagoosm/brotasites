"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { AccountMenu } from "@/components/account/account-menu";
import { postJson } from "@/components/account/api";
import { Captcha } from "@/components/account/captcha";
import { EmailConfirmBanner } from "@/components/account/email-banner";
import { Field, FormError } from "@/components/account/field";
import { MfaEnroll } from "@/components/account/mfa";
import { PasswordField } from "@/components/account/password-field";
import { Brand } from "@/components/brand";
import { Loading, Notice, unavailable } from "@/components/shared/page-state";
import { Button } from "@/components/ui/button";
import { type AccountState, useRequiredAccount } from "@/lib/account";
import { TERMS_VERSION } from "@/lib/auth/schemas";
import { getBrowserSupabase } from "@/lib/supabase/client";

// "Conta" (E15): name and WhatsApp, email, password, two-step verification for the team, the
// terms, other devices, a copy of the data and deleting the account. Every change goes through
// the platform's routes, which check the session again; sensitive ones ask for a recent sign-in.

interface Profile {
  full_name: string;
  phone: string | null;
  terms_version: string | null;
  has_password: boolean;
}

type Signed = Extract<AccountState, { status: "signed-in" }>;

export function AccountPage() {
  const account = useRequiredAccount();
  const params = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [member, setMember] = useState(false);

  const load = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, terms_version, has_password")
      .maybeSingle();
    setProfile(
      (data as Profile | null) ?? {
        full_name: "",
        phone: null,
        terms_version: null,
        has_password: false,
      },
    );
    const { data: isMember } = await supabase.rpc("is_admin_member");
    setMember(isMember === true);
  }, []);

  useEffect(() => {
    if (account.status === "signed-in") void load();
  }, [account.status, load]);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex w-full max-w-[44rem] items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Brand />
        <AccountMenu current="/conta" />
      </header>
      <main className="mx-auto grid w-full max-w-[44rem] gap-10 px-5 pb-24 sm:px-8">
        {account.status === "unavailable" ? (
          <Notice {...unavailable} />
        ) : account.status !== "signed-in" || !profile ? (
          <Loading />
        ) : (
          <>
            <h1 className="font-display text-[2.5rem] leading-[1.05]">Perfil e segurança</h1>
            {params.get("email") === "alterado" && (
              <p
                role="status"
                className="rounded-lg border border-leaf/30 bg-leaf/5 p-3 text-[0.9375rem]"
              >
                E-mail alterado. Os outros aparelhos vão precisar entrar de novo.
              </p>
            )}
            <EmailConfirmBanner account={account} />
            <ProfileSection profile={profile} onSaved={load} />
            {profile.terms_version !== TERMS_VERSION && <TermsSection onSaved={load} />}
            <EmailSection account={account} />
            <PasswordSection account={account} hasPassword={profile.has_password} onSaved={load} />
            {member && <TwoStepSection />}
            <SessionsSection />
            <DataSection />
            <DeleteSection account={account} />
          </>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id: string;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="grid gap-5 rounded-2xl border border-border bg-card p-5 sm:p-7"
    >
      <h2 id={headingId} className="font-display text-[1.5rem] leading-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Saved({ message }: { message: string | null }) {
  return (
    <p role="status" aria-live="polite" className="text-sm text-leaf-deep">
      {message}
    </p>
  );
}

/** A sensitive change needs a sign-in from the last minutes. */
function ReauthNotice({ section }: { section: string }) {
  return (
    <div
      role="alert"
      className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-[0.9375rem]"
    >
      <p>Por segurança, confirme que é você: entre de novo e repita o pedido em até 10 minutos.</p>
      <Link
        href={`/entrar?voltar=${encodeURIComponent(`/conta#${section}`)}`}
        className="touch-target justify-self-start font-semibold text-leaf-deep underline underline-offset-4"
      >
        Entrar de novo
      </Link>
    </div>
  );
}

function ProfileSection({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(null);
    setError(null);
    const result = await postJson("/api/account/profile", { fullName, phone });
    setFields(result.data.fields ?? {});
    if (!result.ok) {
      setError(result.data.error ?? "Não foi possível salvar agora.");
      return;
    }
    setSaved("Dados salvos.");
    onSaved();
  }

  return (
    <Section title="Seus dados" id="dados">
      {!profile.full_name && (
        <p className="text-[0.9375rem] text-ink-soft">
          Complete o seu nome para continuar usando a conta.
        </p>
      )}
      <form onSubmit={save} noValidate className="grid gap-5">
        <FormError message={error} />
        <Field
          label="Seu nome"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={fields.fullName}
        />
        <Field
          label="WhatsApp (opcional)"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(35) 99999-0000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={fields.phone}
          hint="Só para falarmos com você sobre a sua conta. Não aparece no site."
        />
        <Button type="submit" size="lg" className="justify-self-start">
          Salvar
        </Button>
        <Saved message={saved} />
      </form>
    </Section>
  );
}

function TermsSection({ onSaved }: { onSaved: () => void }) {
  const id = useId();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function accept(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted) {
      setError("Marque a caixa para aceitar.");
      return;
    }
    const result = await postJson("/api/account/terms", { version: TERMS_VERSION });
    if (!result.ok) {
      setError(result.data.error ?? "Não foi possível salvar agora.");
      return;
    }
    onSaved();
  }
  return (
    <Section title="Termos e privacidade" id="termos">
      <form onSubmit={accept} noValidate className="grid gap-4">
        <p className="text-[0.9375rem] text-ink-soft">
          Para continuar, aceite a versão atual dos Termos de uso e da Política de Privacidade.
        </p>
        <FormError message={error} />
        <div className="flex items-start gap-3">
          <input
            id={id}
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 size-6 shrink-0 accent-leaf"
          />
          <label htmlFor={id} className="text-[0.9375rem]">
            Li e aceito os{" "}
            <Link
              href="/termos"
              target="_blank"
              className="font-semibold text-leaf-deep underline underline-offset-4"
            >
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link
              href="/privacidade"
              target="_blank"
              className="font-semibold text-leaf-deep underline underline-offset-4"
            >
              Política de Privacidade
            </Link>
            .
          </label>
        </div>
        <Button type="submit" size="lg" className="justify-self-start">
          Aceitar
        </Button>
      </form>
    </Section>
  );
}

function EmailSection({ account }: { account: Signed }) {
  const [email, setEmail] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  async function change(event: React.FormEvent) {
    event.preventDefault();
    setSaved(null);
    setError(null);
    setReauth(false);
    const result = await postJson("/api/account/email", { email });
    setFields(result.data.fields ?? {});
    if (result.data.reauth) return setReauth(true);
    if (!result.ok) return setError(result.data.error ?? "Não foi possível pedir a troca agora.");
    setSaved(`Enviamos um link para ${email.trim()}. A troca vale depois que você tocar nele.`);
  }
  return (
    <Section title="E-mail" id="email">
      <p className="text-[0.9375rem]">
        E-mail atual: <strong>{account.email}</strong>
      </p>
      <form onSubmit={change} noValidate className="grid gap-5">
        {reauth && <ReauthNotice section="email" />}
        <FormError message={error} />
        <Field
          label="Novo e-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fields.email}
        />
        <Button type="submit" size="lg" className="justify-self-start">
          Trocar e-mail
        </Button>
        <Saved message={saved} />
      </form>
    </Section>
  );
}

function PasswordSection({
  account,
  hasPassword,
  onSaved,
}: {
  account: Signed;
  hasPassword: boolean;
  onSaved: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(null);
    setError(null);
    setReauth(false);
    const result = await postJson("/api/account/password", {
      currentPassword: hasPassword ? current : undefined,
      password,
      captchaToken: captcha,
    });
    setAttempt((count) => count + 1);
    setFields(result.data.fields ?? {});
    if (result.data.reauth) return setReauth(true);
    if (!result.ok) return setError(result.data.error ?? "Não foi possível salvar a senha agora.");
    setCurrent("");
    setPassword("");
    setSaved(
      hasPassword
        ? "Senha trocada. Os outros aparelhos vão precisar entrar de novo."
        : "Senha criada. Agora você também pode entrar com ela.",
    );
    onSaved();
  }
  return (
    <Section title={hasPassword ? "Senha" : "Criar senha"} id="senha">
      {!hasPassword && (
        <p className="text-[0.9375rem] text-ink-soft">
          Sua conta entra só com o link no e-mail. Crie uma senha para entrar também com ela.
        </p>
      )}
      <form onSubmit={save} noValidate className="grid gap-5">
        {reauth && <ReauthNotice section="senha" />}
        <FormError message={error} />
        <input
          type="email"
          name="email"
          autoComplete="username"
          value={account.email ?? ""}
          readOnly
          hidden
        />
        {hasPassword && (
          <PasswordField
            label="Senha atual"
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
            error={fields.currentPassword}
          />
        )}
        <PasswordField
          label={hasPassword ? "Nova senha" : "Senha"}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          email={account.email}
          meter
          error={fields.password}
        />
        {hasPassword && <Captcha onToken={setCaptcha} resetKey={attempt} />}
        {fields.captcha && <p className="text-sm text-destructive">{fields.captcha}</p>}
        <Button type="submit" size="lg" className="justify-self-start">
          {hasPassword ? "Trocar senha" : "Criar senha"}
        </Button>
        <Saved message={saved} />
      </form>
    </Section>
  );
}

function TwoStepSection() {
  const [factors, setFactors] = useState<{ id: string; name: string }[] | null>(null);
  const load = useCallback(async () => {
    const { data } = (await getBrowserSupabase()?.auth.mfa.listFactors()) ?? { data: null };
    setFactors(
      (data?.totp ?? [])
        .filter((factor) => factor.status === "verified")
        .map((factor) => ({ id: factor.id, name: factor.friendly_name ?? "Aplicativo" })),
    );
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <Section title="Verificação em duas etapas" id="duas-etapas">
      {factors === null ? null : factors.length > 0 ? (
        <p className="text-[0.9375rem]">
          Ativada com um aplicativo autenticador ({factors.map((factor) => factor.name).join(", ")}
          ). A área da equipe pede o código a cada entrada.
        </p>
      ) : (
        <MfaEnroll onDone={load} />
      )}
    </Section>
  );
}

function SessionsSection() {
  const router = useRouter();
  async function signOutEverywhere() {
    await postJson("/api/account/sessions", { scope: "global" });
    router.replace("/entrar");
    router.refresh();
  }
  return (
    <Section title="Aparelhos conectados" id="aparelhos">
      <p className="text-[0.9375rem] text-ink-soft">
        Se você entrou num aparelho que não é seu, saia de todos. Depois, entre de novo neste.
      </p>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={signOutEverywhere}
        className="justify-self-start"
      >
        Sair de todos os aparelhos
      </Button>
    </Section>
  );
}

function DataSection() {
  return (
    <Section title="Seus dados" id="baixar">
      <p className="text-[0.9375rem] text-ink-soft">
        Baixe uma cópia de tudo o que guardamos da sua conta: perfil, aceite dos termos e, de cada
        site, as respostas, a configuração, as direções, o histórico e os pagamentos.
      </p>
      <a
        href="/api/account/export"
        download
        className="touch-target inline-flex h-12 items-center justify-self-start rounded-full border border-border bg-background px-7 font-semibold hover:bg-accent"
      >
        Baixar meus dados (.json)
      </a>
    </Section>
  );
}

function DeleteSection({ account }: { account: Signed }) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function remove(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setReauth(false);
    setDeleting(true);
    const result = await postJson("/api/account/delete", { email: confirmEmail });
    setDeleting(false);
    setFields(result.data.fields ?? {});
    if (result.data.reauth) return setReauth(true);
    if (!result.ok) return setError(result.data.error ?? "Não foi possível excluir a conta agora.");
    window.location.assign("/?conta=excluida");
  }
  return (
    <Section title="Excluir minha conta" id="excluir">
      <div className="grid gap-2 text-[0.9375rem] text-ink-soft">
        <p>
          Apagamos a conta, todos os sites, rascunhos e fotos, e os sites publicados saem do ar.
          Isso não pode ser desfeito. Se quiser, baixe seus dados antes.
        </p>
        <p>
          Se você pagou pela publicação de algum site, os registros desses pagamentos ficam
          guardados pelo prazo que a lei fiscal exige, sem o site.
        </p>
      </div>
      <form onSubmit={remove} noValidate className="grid gap-5">
        {reauth && <ReauthNotice section="excluir" />}
        <FormError message={error} />
        <Field
          label={`Para confirmar, escreva o seu e-mail (${account.email})`}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          error={fields.email}
        />
        <Button
          type="submit"
          variant="destructive"
          size="lg"
          disabled={deleting}
          className="justify-self-start"
        >
          {deleting ? "Excluindo…" : "Excluir minha conta"}
        </Button>
      </form>
    </Section>
  );
}
