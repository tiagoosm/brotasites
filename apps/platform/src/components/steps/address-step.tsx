"use client";

import { formatPhone, suggestSubdomain } from "@brotasites/schema";
import {
  categoryInfo,
  type FormStepSlug12,
  formSteps12,
  sectionsOf,
} from "@brotasites/schema/v1.2";
import { ArrowRight, Check, ExternalLink, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { StepFooter } from "@/components/wizard/step-footer";
import { StepHeader } from "@/components/wizard/step-header";
import { useForm12 } from "@/lib/form-store";
import {
  AddressError,
  type Availability,
  alternativeSubdomain,
  checkSubdomain,
  localSubdomainProblem,
  reserveSubdomain,
  tidySubdomain,
} from "@/lib/publication";
import { infoFor } from "@/lib/site-status";
import { SITES_DOMAIN } from "@/lib/site-url";
import { approveSite, previewUrl, SiteActionError } from "@/lib/sites";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { SectionCard } from "./fields";

// Step 7: the address, a last look at the answers, the finished site and the approval.
// Approving leads to the one-time payment; the site goes live once it is paid.

const CHECK_DELAY_MS = 400;
const LOCKED_ADDRESS = ["publishing", "live", "grace", "suspended"];

export function AddressStep() {
  const router = useRouter();
  const { draft, site, siteId, updateDraft, reloadSite, completeStep } = useForm12();
  const typed = draft.site?.subdomain ?? site?.subdomain ?? "";
  const saved = site?.subdomain ?? null;
  const status = site?.status ?? "draft";
  const addressLocked = LOCKED_ADDRESS.includes(status);
  const availability = useAvailability(typed, draft.business?.city);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = site ? previewUrl(site) : null;

  // Start from the business name, the way most clients would write it.
  useEffect(() => {
    if (draft.site?.subdomain !== undefined || saved) return;
    const suggestion = suggestSubdomain(draft.business?.name);
    if (suggestion) updateDraft((d) => ({ ...d, site: { ...d.site, subdomain: suggestion } }));
  }, [draft.site?.subdomain, draft.business?.name, saved, updateDraft]);

  async function keepAddress() {
    const supabase = getBrowserSupabase();
    if (!supabase || availability.state !== "available") return;
    setSaving(true);
    setError(null);
    try {
      await reserveSubdomain(supabase, siteId, typed);
      await reloadSite();
    } catch (caught) {
      setError(
        caught instanceof AddressError
          ? caught.message
          : "Não foi possível guardar o endereço agora.",
      );
    }
    setSaving(false);
  }

  async function approve() {
    if (!saved || status !== "awaiting_approval") return;
    setApproving(true);
    setError(null);
    try {
      const result = await approveSite(siteId);
      completeStep("endereco");
      router.push(
        result.paymentId
          ? `/meus-sites/${siteId}/pagamento?p=${result.paymentId}`
          : `/meus-sites/${siteId}`,
      );
    } catch (caught) {
      setError(
        caught instanceof SiteActionError ? caught.message : "Não foi possível aprovar agora.",
      );
      setApproving(false);
    }
  }

  const action =
    status === "awaiting_approval" ? (
      <Button
        type="submit"
        size="lg"
        disabled={!saved || approving}
        className="group ml-auto flex-1 sm:flex-none"
      >
        {approving ? (
          <>
            <LoaderCircle aria-hidden="true" className="animate-spin" />
            Aprovando…
          </>
        ) : (
          <>
            Aprovar e publicar
            <ArrowRight
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </>
        )}
      </Button>
    ) : (
      <Button asChild size="lg" className="ml-auto flex-1 sm:flex-none">
        <Link href={`/meus-sites/${siteId}`}>Ir para o painel</Link>
      </Button>
    );

  return (
    <form
      noValidate
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void approve();
      }}
    >
      <StepHeader step="endereco" />
      <div className="grid gap-10">
        <SectionCard name="Endereço do site" note="Depois de publicado, o endereço não muda.">
          <SubdomainField
            value={typed}
            disabled={addressLocked}
            availability={saved === typed ? { state: "available" } : availability}
            onChange={(value) =>
              updateDraft((d) => ({ ...d, site: { ...d.site, subdomain: value } }))
            }
          />
          {!addressLocked &&
            (saved === typed ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-leaf-deep">
                <Check aria-hidden="true" className="size-4" />
                Endereço guardado para o seu site.
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="justify-self-start"
                disabled={availability.state !== "available" || saving}
                onClick={() => void keepAddress()}
              >
                {saving ? "Guardando…" : "Guardar este endereço"}
              </Button>
            ))}
        </SectionCard>

        <SectionCard name="Site pronto">
          <p className="text-[0.9375rem]">
            <strong>{infoFor(status).label}.</strong> {infoFor(status).text}
          </p>
          {preview && ["awaiting_approval", "publishing", "live"].includes(status) && (
            <a
              href={preview}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 justify-self-start font-semibold text-leaf-deep underline underline-offset-4"
            >
              Ver o site pronto
              <ExternalLink aria-hidden="true" className="size-4" />
              <span className="sr-only">(abre em outra aba)</span>
            </a>
          )}
          {status === "awaiting_approval" && (
            <p className="text-sm text-ink-soft">
              Quer mudar algo? Ajuste as respostas e peça uma nova versão na{" "}
              <Link
                href={`/meus-sites/${siteId}`}
                className="font-semibold text-leaf-deep underline underline-offset-4"
              >
                página do site
              </Link>
              . {saved ? "" : "Guarde o endereço antes de aprovar."}
            </p>
          )}
        </SectionCard>

        <SectionCard name="Revisão" note="Confira as respostas. Toque em uma parte para mudar.">
          <Summary />
        </SectionCard>

        {error && (
          <p role="alert" className="text-[0.9375rem] font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>
      <StepFooter step="endereco" action={action} />
    </form>
  );
}

/** Checks the address after a short pause in typing. */
function useAvailability(subdomain: string, city: string | undefined): Availability {
  const [result, setResult] = useState<{ for: string; availability: Availability }>({
    for: "",
    availability: { state: "checking" },
  });
  const problem = subdomain ? localSubdomainProblem(subdomain) : null;

  useEffect(() => {
    if (!subdomain || problem) return;
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setResult({ for: subdomain, availability: { state: "unknown" } });
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      checkSubdomain(supabase, subdomain)
        .then((free) => {
          if (cancelled) return;
          setResult({
            for: subdomain,
            availability: free
              ? { state: "available" }
              : { state: "taken", suggestion: alternativeSubdomain(subdomain, city) },
          });
        })
        .catch(
          () => !cancelled && setResult({ for: subdomain, availability: { state: "unknown" } }),
        );
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [subdomain, problem, city]);

  if (!subdomain) return { state: "invalid", message: "Escolha o endereço do site." };
  if (problem) return { state: "invalid", message: problem };
  return result.for === subdomain ? result.availability : { state: "checking" };
}

function SubdomainField({
  value,
  disabled,
  availability,
  onChange,
}: {
  value: string;
  disabled: boolean;
  availability: Availability;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  const bad = availability.state === "invalid" || availability.state === "taken";
  return (
    <div className="grid gap-2.5">
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        Endereço
      </label>
      <div
        className={cn(
          "flex h-13 min-w-0 items-center rounded-lg border bg-card transition-[border-color,box-shadow] duration-150 focus-within:ring-4",
          bad
            ? "border-destructive focus-within:ring-destructive/20"
            : "border-input focus-within:border-leaf focus-within:ring-leaf/15",
        )}
      >
        <input
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(tidySubdomain(event.target.value))}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={noteId}
          aria-invalid={bad || undefined}
          className="h-full min-w-0 flex-1 rounded-l-lg bg-transparent pl-4 font-mono text-[0.9375rem] text-ink outline-none"
        />
        <span className="shrink-0 truncate pr-4 font-mono text-[0.9375rem] text-ink-soft">
          .{SITES_DOMAIN}
        </span>
      </div>
      {!disabled && <AvailabilityNote id={noteId} availability={availability} onUse={onChange} />}
    </div>
  );
}

function AvailabilityNote({
  id,
  availability,
  onUse,
}: {
  id: string;
  availability: Availability;
  onUse: (value: string) => void;
}) {
  const base = "flex items-start gap-2 text-sm";
  switch (availability.state) {
    case "checking":
      return (
        <p id={id} role="status" className={cn(base, "text-ink-soft")}>
          <LoaderCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin" />
          Conferindo se está livre…
        </p>
      );
    case "available":
      return (
        <p id={id} role="status" className={cn(base, "font-semibold text-leaf-deep")}>
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Disponível.
        </p>
      );
    case "taken":
      return (
        <div id={id} role="status" className={cn(base, "flex-wrap text-destructive")}>
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>Esse endereço já está em uso.</span>
          {availability.suggestion && (
            <button
              type="button"
              onClick={() => onUse(availability.suggestion as string)}
              className="font-semibold text-leaf-deep underline underline-offset-4"
            >
              Usar {availability.suggestion}
            </button>
          )}
        </div>
      );
    case "invalid":
      return (
        <p id={id} role="status" className={cn(base, "text-destructive")}>
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {availability.message}
        </p>
      );
    case "unknown":
      return (
        <p id={id} role="status" className={cn(base, "text-ink-soft")}>
          Não foi possível conferir agora. Tente de novo em instantes.
        </p>
      );
  }
}

const sectionNames: Record<string, string> = {
  sobre: "Sobre",
  servicos: "Serviços",
  "como-funciona": "Como funciona",
  diferenciais: "Diferenciais",
  galeria: "Galeria",
  depoimentos: "Depoimentos",
  faq: "Perguntas frequentes",
  "cta-final": "Chamada final",
  contato: "Contato",
};

function Summary() {
  const { draft, siteId } = useForm12();
  const business = draft.business ?? {};
  const contact = draft.contact ?? {};
  const content = draft.content ?? {};
  const channels = [
    contact.whatsapp && `WhatsApp ${formatPhone(contact.whatsapp)}`,
    contact.phone && `Telefone ${formatPhone(contact.phone)}`,
    contact.email,
  ].filter(Boolean);
  const services = (content.services ?? []).filter((s) => s.name?.trim()).length;
  const photos = (content.photos ?? []).length;
  const rows: [FormStepSlug12, string][] = [
    [
      "negocio",
      [
        business.name,
        business.category && categoryInfo(business.category)?.label,
        [business.city, business.state].filter(Boolean).join(" - "),
      ]
        .filter(Boolean)
        .join(" · ") || "Ainda sem respostas",
    ],
    [
      "marca",
      [
        draft.brand?.logoAsset ? "Com logo" : "Sem logo (monograma)",
        draft.brand?.feelings?.length ? draft.brand.feelings.join(" e ") : null,
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    [
      "secoes",
      sectionsOf(draft)
        .map((id) => sectionNames[id] ?? id)
        .join(", "),
    ],
    [
      "conteudo",
      `${services} ${services === 1 ? "serviço" : "serviços"} · ${photos} ${photos === 1 ? "foto" : "fotos"}`,
    ],
    ["contato", channels.join(" · ") || "Nenhum canal ainda"],
  ];
  return (
    <dl className="grid gap-3">
      {rows.map(([slug, text]) => (
        <div key={slug} className="grid gap-1 border-b border-border pb-3 last:border-0">
          <dt className="flex items-baseline justify-between gap-3">
            <span className="tag text-stem">{formSteps12.find((s) => s.slug === slug)?.title}</span>
            <Link
              href={`/criar/${siteId}/${slug}`}
              className="text-sm font-semibold text-leaf-deep underline-offset-4 hover:underline"
            >
              Mudar
            </Link>
          </dt>
          <dd className="text-[0.9375rem]">{text}</dd>
        </div>
      ))}
    </dl>
  );
}
