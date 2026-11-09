"use client";

import { Check, Copy, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { pricing } from "@/config/pricing";
import {
  type DomainFailure,
  type DomainStatus,
  domainFailure,
  domainStatus,
  recordPurpose,
} from "@/lib/domains/copy";
import { cn } from "@/lib/utils";

// "Usar o seu próprio domínio" (E25), on the page of a published (paid) site: optional and
// included in the price. The client types the domain, copies the DNS records to the registrar,
// and the domain serves the site once the hosting has proved it. The BrotaSites address keeps
// working whatever happens here (Murphy); every action answers at once (Doherty).

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  purpose: string;
}

interface SiteDomain {
  host: string;
  aliasHost: string | null;
  status: DomainStatus;
  primary: boolean;
  records: DnsRecord[];
  failure: DomainFailure | null;
}

async function call<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(
      payload.error ?? "Não foi possível fazer isso agora. Tente de novo em instantes.",
    );
  }
  return payload;
}

export function CustomDomain({
  siteId,
  siteAddress,
  wish,
}: {
  siteId: string;
  /** The BrotaSites address, for the choice of the main one. */
  siteAddress: string | null;
  /** A domain the client noted before publishing (Publicar), to start from. */
  wish?: string;
}) {
  const base = `/api/sites/${siteId}/domain`;
  const inputId = useId();
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState(true);
  const [domain, setDomain] = useState<SiteDomain | null>(null);
  const [typed, setTyped] = useState(wish ?? "");
  const [busy, setBusy] = useState<null | "connect" | "check" | "primary" | "remove">(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await call<{ domain: SiteDomain | null; available: boolean }>(base);
      setDomain(result.domain);
      setAvailable(result.available);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : null);
    }
    setLoaded(true);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(kind: NonNullable<typeof busy>, run: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setNote(null);
    try {
      await run();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível fazer isso agora.");
    }
    setBusy(null);
  }

  const heading = (
    <div className="grid gap-1.5">
      <h2 id="dominio-titulo" className="font-display text-[1.75rem] leading-tight">
        Usar o seu próprio domínio
      </h2>
      <p className="text-[0.9375rem] text-ink-soft">
        Opcional{pricing.customDomainIncluded ? " e incluído no preço" : ""}: o site também abre em
        seunegocio.com.br. O registro do domínio é por sua conta, no registrador.
      </p>
    </div>
  );

  const feedback = (
    <>
      {error && (
        <p role="alert" className="text-[0.9375rem] font-semibold text-destructive">
          {error}
        </p>
      )}
      {note && (
        <p role="status" className="text-[0.9375rem] font-semibold text-leaf-deep">
          {note}
        </p>
      )}
    </>
  );

  return (
    <section id="dominio" aria-labelledby="dominio-titulo" className="grid scroll-mt-24 gap-5">
      {heading}
      {!loaded ? (
        <p role="status" className="flex items-center gap-2 text-[0.9375rem] text-ink-soft">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Carregando…
        </p>
      ) : !domain ? (
        !available ? (
          <p className="rounded-lg border border-border bg-paper p-4 text-[0.9375rem] text-ink-soft">
            A conexão de domínio próprio estará disponível em breve.
          </p>
        ) : (
          <form
            noValidate
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void act("connect", async () => {
                const result = await call<{ domain: SiteDomain }>(base, { host: typed });
                setDomain(result.domain);
              });
            }}
          >
            <label htmlFor={inputId} className="text-[0.9375rem] font-semibold">
              Seu domínio
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="seunegocio.com.br"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={253}
              aria-describedby={error ? `${inputId}-erro` : undefined}
              className="h-13 rounded-lg border border-input bg-card px-4 font-mono text-[0.9375rem] outline-none focus:border-leaf focus:ring-4 focus:ring-leaf/15"
            />
            {error && (
              <p
                id={`${inputId}-erro`}
                role="alert"
                className="text-[0.9375rem] font-semibold text-destructive"
              >
                {error}
              </p>
            )}
            <Button
              aria-busy={busy === "connect" || undefined}
              type="submit"
              size="lg"
              className="justify-self-start"
              disabled={busy !== null}
            >
              {busy === "connect" ? "Conectando…" : "Conectar domínio"}
            </Button>
          </form>
        )
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-1.5 rounded-xl border border-input bg-card p-4">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-[0.9375rem] break-all">{domain.host}</span>
              <span
                className={cn(
                  "tag",
                  domain.status === "active"
                    ? "text-leaf-deep"
                    : domain.status === "failed"
                      ? "text-destructive"
                      : "text-stem",
                )}
              >
                {domainStatus[domain.status].label}
              </span>
            </p>
            <p className="text-[0.9375rem] text-ink-soft">
              {domain.status === "failed" && domain.failure
                ? `${domainStatus.failed.text} ${domainFailure[domain.failure]}`
                : domainStatus[domain.status].text}
            </p>
          </div>

          {domain.status !== "active" && domain.records.length > 0 && <DnsSteps domain={domain} />}

          {domain.status === "active" && siteAddress && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-[0.9375rem] font-semibold">Endereço principal</legend>
              {[
                { value: true, label: domain.host },
                { value: false, label: siteAddress },
              ].map((option) => (
                <label key={String(option.value)} className="flex min-h-11 items-center gap-3">
                  <input
                    type="radio"
                    name="principal"
                    checked={domain.primary === option.value}
                    disabled={busy !== null}
                    onChange={() =>
                      void act("primary", async () => {
                        const result = await call<{ domain: SiteDomain }>(`${base}/primary`, {
                          primary: option.value,
                        });
                        setDomain(result.domain);
                        setNote("Endereço principal atualizado. O outro leva a ele.");
                      })
                    }
                    className="size-5 accent-[var(--leaf)]"
                  />
                  <span className="font-mono text-[0.9375rem] break-all">{option.label}</span>
                </label>
              ))}
            </fieldset>
          )}

          {feedback}

          <div className="flex flex-wrap items-center gap-3">
            {domain.status !== "active" && (
              <Button
                aria-busy={busy === "check" || undefined}
                size="lg"
                disabled={busy !== null}
                onClick={() =>
                  void act("check", async () => {
                    const result = await call<{ domain: SiteDomain }>(`${base}/check`, {});
                    setDomain(result.domain);
                    if (result.domain.status === "active")
                      setNote("Tudo certo: o domínio está ativo.");
                  })
                }
              >
                {busy === "check" ? "Verificando…" : "Verificar agora"}
              </Button>
            )}
            {confirming ? (
              <div className="grid basis-full gap-3 border-t border-line pt-4">
                <p className="text-[0.9375rem]">
                  Desconectar {domain.host}? O site continua no endereço da BrotaSites.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    aria-busy={busy === "remove" || undefined}
                    variant="destructive"
                    size="lg"
                    disabled={busy !== null}
                    onClick={() =>
                      void act("remove", async () => {
                        await call(`${base}/remove`, { confirm: true });
                        setDomain(null);
                        setConfirming(false);
                        setTyped("");
                        setNote("Domínio desconectado.");
                      })
                    }
                  >
                    {busy === "remove" ? "Removendo…" : "Sim, remover"}
                  </Button>
                  <Button variant="ghost" size="lg" onClick={() => setConfirming(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="lg"
                className="ml-auto text-destructive"
                disabled={busy !== null}
                onClick={() => setConfirming(true)}
              >
                Remover domínio
              </Button>
            )}
          </div>
        </div>
      )}
      {!domain && loaded && note && feedback}
    </section>
  );
}

/** The step-by-step for the registrar, with each value to copy in one tap. */
function DnsSteps({ domain }: { domain: SiteDomain }) {
  return (
    <div className="grid gap-4">
      <h3 className="text-[1.0625rem] font-semibold">Como configurar</h3>
      <ol className="grid list-decimal gap-3 pl-5 text-[0.9375rem]">
        <li>
          Entre no site onde você registrou o domínio (o registrador) e abra a área de DNS. Ela
          costuma se chamar Zona DNS, DNS ou Gerenciar DNS.
        </li>
        <li>
          Crie cada registro abaixo, do tipo indicado, com o nome e o valor exatos. Toque em Copiar
          para não errar. Alguns registradores pedem só a primeira parte do nome (por exemplo, www).
        </li>
        {domain.aliasHost && (
          <li>
            Para {domain.aliasHost} (sem www) também funcionar, ative no registrador o
            redirecionamento de {domain.aliasHost} para https://{domain.host}.
          </li>
        )}
        <li>
          A mudança pode levar de alguns minutos a algumas horas (às vezes até 48 horas). Depois,
          toque em Verificar agora. Nós também conferimos sozinhos todos os dias, por 7 dias.
        </li>
        <li>
          Se algo falhar, confira se os registros estão iguais, sem espaço a mais, e se o domínio
          não usa outro serviço que esconde o DNS.
        </li>
      </ol>
      <ul className="grid gap-3">
        {domain.records.map((record) => (
          <li
            key={`${record.type}-${record.name}`}
            className="grid gap-2 rounded-xl border border-input bg-card p-4"
          >
            <p className="tag text-stem">
              {record.type} · {recordPurpose[record.purpose] ?? "Registro"}
            </p>
            <CopyRow label="Nome" value={record.name} />
            <CopyRow label="Valor" value={record.value} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-12 shrink-0 text-sm text-ink-soft">{label}</span>
      <code className="min-w-0 flex-1 font-mono text-[0.875rem] break-all">{value}</code>
      <Button
        variant="outline"
        size="sm"
        className="h-11 min-w-11 px-3"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            },
            () => setCopied(false),
          );
        }}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Copiado" : "Copiar"}
        <span className="sr-only"> {label.toLowerCase()}</span>
      </Button>
    </div>
  );
}
