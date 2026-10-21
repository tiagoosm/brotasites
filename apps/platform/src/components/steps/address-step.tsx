"use client";

import {
  buildPreviewConfig,
  draftSections,
  type FormStepSlug,
  formatPhone,
  formSteps,
  publishProblems,
  sectionInfo,
  suggestSubdomain,
  templateOptions,
} from "@brotasites/schema";
import { ArrowRight, Check, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { StepFooter } from "@/components/wizard/step-footer";
import { StepHeader } from "@/components/wizard/step-header";
import { useDraft } from "@/lib/draft-store";
import {
  type Availability,
  alternativeSubdomain,
  checkSubdomain,
  localSubdomainProblem,
  PublishError,
  requestPublication,
  tidySubdomain,
} from "@/lib/publication";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { SectionCard } from "./fields";

// Question 7: the site address, a last look at every answer, and the publish button.

const CHECK_DELAY_MS = 400;

export function AddressStep() {
  const router = useRouter();
  const { draft, account, updateDraft, completeStep, ensureSite } = useDraft();
  const subdomain = draft.site?.subdomain ?? "";
  const availability = useAvailability(subdomain, draft.business?.contact?.address?.city);
  const problems = useMemo(() => publishProblems(draft), [draft]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the business name, the way most clients would write it.
  useEffect(() => {
    if (draft.site?.subdomain !== undefined) return;
    const suggestion = suggestSubdomain(draft.business?.name);
    if (suggestion) updateDraft((d) => ({ ...d, site: { ...d.site, subdomain: suggestion } }));
  }, [draft.site?.subdomain, draft.business?.name, updateDraft]);

  const ready = problems.length === 0 && availability.state === "available";

  async function publish() {
    setError(null);
    const supabase = getBrowserSupabase();
    if (!supabase || !ready) return;
    setPublishing(true);
    try {
      const owner = await ensureSite();
      if (!owner) throw new PublishError("Entre de novo para publicar.");
      await requestPublication(supabase, owner.siteId, subdomain);
      completeStep("endereco");
      router.push("/meu-site");
    } catch (caught) {
      setError(
        caught instanceof PublishError
          ? caught.message
          : "Não foi possível publicar agora. Tente de novo em instantes.",
      );
      setPublishing(false);
    }
  }

  const action =
    account.status === "signed-in" ? (
      <Button
        type="submit"
        size="lg"
        disabled={!ready || publishing}
        className="group ml-auto flex-1 sm:flex-none"
      >
        {publishing ? (
          <>
            <LoaderCircle aria-hidden="true" className="animate-spin" />
            Publicando…
          </>
        ) : (
          <>
            Publicar meu site
            <ArrowRight
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </>
        )}
      </Button>
    ) : (
      <Button asChild size="lg" className="ml-auto flex-1 sm:flex-none">
        <Link href={`/entrar?voltar=${encodeURIComponent("/criar/endereco")}`}>
          Entrar para publicar
        </Link>
      </Button>
    );

  return (
    <form
      noValidate
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void publish();
      }}
    >
      <StepHeader step="endereco" />
      <div className="grid gap-10">
        <SectionCard name="Endereço do site">
          <SubdomainField
            value={subdomain}
            availability={availability}
            onChange={(value) =>
              updateDraft((d) => ({ ...d, site: { ...d.site, subdomain: value } }))
            }
          />
        </SectionCard>

        <SectionCard
          name="Revisão"
          note="Confira cada resposta. Tudo pode ser mudado depois de publicar."
        >
          {problems.length > 0 && <Problems problems={problems} />}
          <Summary />
        </SectionCard>

        {account.status !== "signed-in" && (
          <p className="text-[0.9375rem] text-ink-soft">
            Para publicar, entre com o seu e-mail. O seu rascunho vai junto.
          </p>
        )}
        {error && (
          <p role="alert" className="text-[0.9375rem] text-destructive">
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
  availability,
  onChange,
}: {
  value: string;
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
          onChange={(event) => onChange(tidySubdomain(event.target.value))}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={noteId}
          aria-invalid={bad || undefined}
          className="h-full min-w-0 flex-1 rounded-l-lg bg-transparent pl-4 font-mono text-[0.9375rem] text-ink outline-none"
        />
        <span className="shrink-0 pr-4 font-mono text-[0.9375rem] text-ink-soft">
          .brotasites.com
        </span>
      </div>
      <AvailabilityNote id={noteId} availability={availability} onUse={onChange} />
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
          Disponível. Esse será o endereço do seu site.
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

const stepTitle = (slug: FormStepSlug) => formSteps.find((s) => s.slug === slug)?.title ?? slug;

function Problems({ problems }: { problems: { step: FormStepSlug; message: string }[] }) {
  return (
    <div className="grid gap-3 rounded-lg border border-pollen/60 bg-pollen/10 p-4">
      <p className="font-semibold">
        {problems.length === 1
          ? "Falta 1 coisa para publicar"
          : `Faltam ${problems.length} coisas para publicar`}
      </p>
      <ul className="grid gap-2.5 text-[0.9375rem]">
        {problems.map((problem) => (
          <li
            key={`${problem.step}-${problem.message}`}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
          >
            <span>{problem.message}</span>
            <Link
              href={`/criar/${problem.step}`}
              className="text-sm font-semibold text-leaf-deep underline-offset-4 hover:underline"
            >
              Corrigir em {stepTitle(problem.step).toLocaleLowerCase("pt-BR")}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const sectionNames = new Map(sectionInfo.map((info) => [info.id, info.name]));

/** One line per question, with a way back to it. */
function Summary() {
  const { draft } = useDraft();
  const config = useMemo(() => buildPreviewConfig(draft), [draft]);
  const { business, design } = config;
  const contact = draft.business?.contact;
  const photos = draftSections(draft).reduce((count, section) => {
    const content = section.content ?? {};
    const gallery = Array.isArray(content.images) ? content.images.length : 0;
    return count + gallery + (typeof content.image === "string" && content.image ? 1 : 0);
  }, 0);

  const rows: { step: FormStepSlug; value: React.ReactNode }[] = [
    {
      step: "negocio",
      value: [draft.business?.name, draft.business?.category, contact?.address?.city]
        .filter(Boolean)
        .join(" · "),
    },
    { step: "modelo", value: templateOptions.find((t) => t.id === design.template)?.name },
    {
      step: "cores",
      value: (
        <span className="inline-flex items-center gap-2.5">
          <span className="inline-flex" aria-hidden="true">
            {[design.colors.primary, design.colors.secondary, design.colors.background].map(
              (color, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed list of three swatches
                  key={i}
                  className="-ml-1 size-4 rounded-full border border-card first:ml-0"
                  style={{ background: color }}
                />
              ),
            )}
          </span>
          {design.fonts.heading} e {design.fonts.body}
        </span>
      ),
    },
    {
      step: "secoes",
      value: config.sections
        .filter((s) => s.enabled)
        .map((s) => sectionNames.get(s.id))
        .join(", "),
    },
    {
      step: "conteudo",
      value: `Título: ${(config.sections.find((s) => s.id === "hero")?.content as { title?: string })?.title ?? business.name}`,
    },
    {
      step: "contato",
      value:
        [
          contact?.whatsapp && `WhatsApp ${formatPhone(contact.whatsapp)}`,
          photos > 0 && (photos === 1 ? "1 foto" : `${photos} fotos`),
        ]
          .filter(Boolean)
          .join(" · ") || "Nada informado ainda",
    },
  ];

  return (
    <dl className="grid divide-y divide-border">
      {rows.map((row) => (
        <div
          key={row.step}
          className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 py-3.5 first:pt-0 last:pb-0"
        >
          <dt className="tag text-stem">{stepTitle(row.step)}</dt>
          <dd className="row-start-2 min-w-0 text-[0.9375rem] break-words">{row.value || "—"}</dd>
          <dd className="row-span-2 self-center">
            <Link
              href={`/criar/${row.step}`}
              aria-label={`Editar ${stepTitle(row.step).toLocaleLowerCase("pt-BR")}`}
              className="text-sm font-semibold text-leaf-deep underline-offset-4 hover:underline"
            >
              Editar
            </Link>
          </dd>
        </div>
      ))}
    </dl>
  );
}
