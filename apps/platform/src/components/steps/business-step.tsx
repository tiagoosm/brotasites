"use client";

import { brazilianStates } from "@brotasites/schema";
import {
  blockedTopic,
  businessAnswersSchema,
  categoryNotOpen,
  type FormDraft,
  storyHints,
  storyQuestions,
} from "@brotasites/schema/v1.2";
import { useEffect, useId, useState } from "react";
import { useForm12 } from "@/lib/form-store";
import { yearProblem, yearText, yearValue } from "@/lib/year-input";
import { CategorySearch } from "./category-search";
import { DescriptionCoach } from "./description-coach";
import { SectionCard, TextField } from "./fields";
import { LockedNote, StepForm } from "./step-form";

// Step 1: the business (docs/form-flow.md). The optional questions make the site specific: the
// AI only writes from facts the client gives.

type Business = NonNullable<FormDraft["business"]>;

export function BusinessStep() {
  const { draft, updateDraft, identityLocked } = useForm12();
  const business = draft.business ?? {};
  const set = (patch: Partial<Business>) =>
    updateDraft((d) => ({ ...d, business: { ...d.business, ...patch } }));
  const blocked = blockedTopic(
    business.name,
    business.description,
    ...Object.values(business.story ?? {}),
  );
  const notOpen = categoryNotOpen(business.category);
  // The year as typed (E38): the draft gets a number only at 4 digits.
  const [year, setYear] = useState(() =>
    business.foundedYear ? String(business.foundedYear) : "",
  );
  const [yearDone, setYearDone] = useState(false);
  useEffect(() => {
    // A draft loaded or changed elsewhere: show its year, unless the text already says it.
    setYear((text) =>
      yearValue(text) === business.foundedYear
        ? text
        : business.foundedYear
          ? String(business.foundedYear)
          : text.length === 4
            ? ""
            : text,
    );
  }, [business.foundedYear]);

  return (
    <StepForm
      step="negocio"
      validate={() => {
        if (blocked) return `Não atendemos negócios de ${blocked}.`;
        if (notOpen) return notOpen;
        const yearIssue = yearProblem(year, true);
        if (yearIssue) {
          setYearDone(true);
          return yearIssue;
        }
        const parsed = businessAnswersSchema.safeParse({
          ...business,
          name: business.name ?? "",
          city: business.city ?? "",
          description: business.description ?? "",
        });
        return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Confira as respostas.");
      }}
    >
      {identityLocked && (
        <LockedNote>Visual já aprovado. Mudanças aqui entram na próxima versão do site.</LockedNote>
      )}
      <SectionCard name="O básico">
        <TextField
          label="Nome do negócio"
          value={business.name}
          maxLength={80}
          autoComplete="organization"
          placeholder="Ex.: Padaria do Zé"
          onChange={(name) => set({ name })}
        />
        <CategorySearch value={business.category} onChange={(category) => set({ category })} />
        {notOpen && (
          <p role="status" className="text-sm font-semibold text-destructive">
            {notOpen}
          </p>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,7rem)] gap-5">
          <TextField
            label="Cidade"
            value={business.city}
            maxLength={80}
            autoComplete="address-level2"
            onChange={(city) => set({ city })}
          />
          <StateField
            value={business.state}
            onChange={(state) => set({ state: state as Business["state"] })}
          />
        </div>
        <TextField
          label="Conte em poucas palavras o que você faz"
          multiline
          value={business.description}
          maxLength={500}
          hint="Do seu jeito, com detalhes: o que você vende, para quem, desde quando."
          onChange={(description) => set({ description })}
        />
        <DescriptionCoach category={business.category} description={business.description} />
        <TextField
          label="Ano em que começou (opcional)"
          inputMode="numeric"
          autoComplete="off"
          value={year}
          maxLength={4}
          placeholder="Ex.: 1998"
          error={yearProblem(year, yearDone) ?? undefined}
          onBlur={() => setYearDone(true)}
          onChange={(typed) => {
            const text = yearText(typed);
            setYear(text);
            // Typing again hides the "4 números" note until the person leaves the field.
            setYearDone(false);
            if (yearValue(text) !== business.foundedYear) set({ foundedYear: yearValue(text) });
          }}
        />
      </SectionCard>

      <SectionCard
        name="Deixe o site com a sua cara"
        note="Opcional, mas faz diferença: o site usa só o que você contar. Nomes, lugares e detalhes concretos deixam o texto com a sua cara."
      >
        {storyQuestions.map(([key, question]) => (
          <TextField
            key={key}
            label={question}
            multiline
            value={business.story?.[key]}
            hint={storyHints[key]}
            maxLength={200}
            onChange={(answer) => set({ story: { ...business.story, [key]: answer } })}
          />
        ))}
      </SectionCard>

      {blocked && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-paper p-4 text-[0.9375rem]"
        >
          <p className="font-semibold">Esse tipo de negócio a gente não atende.</p>
          <p className="text-ink-soft">
            Pelo que você escreveu, o site seria sobre {blocked}, e isso a BrotaSites não publica.
            Nada foi cobrado. Se entendemos errado, ajuste o texto acima.
          </p>
        </div>
      )}
    </StepForm>
  );
}

export function StateField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (state: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        Estado
      </label>
      <select
        id={id}
        value={value ?? ""}
        autoComplete="address-level1"
        onChange={(event) => onChange(event.target.value)}
        className="h-13 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base text-ink outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/15"
      >
        <option value="">UF</option>
        {brazilianStates.map((uf) => (
          <option key={uf} value={uf}>
            {uf}
          </option>
        ))}
      </select>
    </div>
  );
}
