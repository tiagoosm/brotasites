"use client";

import { brandAnswersSchema, type Feeling, feelings } from "@brotasites/schema/v1.2";
import { Check } from "lucide-react";
import { chipClass } from "@/components/shared/chip";
import { useForm12 } from "@/lib/form-store";
import { cn } from "@/lib/utils";
import { PickFiles, Thumb, UploadStatus, useAssetUrls, useUploader } from "./asset-upload";
import { SectionCard } from "./fields";
import { ChoiceGroup, LockedNote, StepForm } from "./step-form";

// Step 2: logo, brand colors and up to 2 feelings. They shape the 3 directions; once one is
// approved the identity locks and only the logo can change here.

const feelingText: Record<Feeling, string> = {
  acolhedor: "Acolhedor: próximo, caseiro, de confiança",
  elegante: "Elegante: sóbrio, cuidadoso, refinado",
  moderno: "Moderno: limpo, direto, atual",
  robusto: "Robusto: forte, firme, de oficina",
  ousado: "Ousado: vibrante, chamativo, criativo",
};

export function BrandStep() {
  const { draft, updateDraft, identityLocked } = useForm12();
  const brand = draft.brand ?? {};
  const colors = brand.brandColors ?? [];
  const chosen = brand.feelings ?? [];
  const logo = useUploader("logo");
  const [urls, remember] = useAssetUrls([brand.logoAsset]);
  const set = (patch: Partial<NonNullable<typeof draft.brand>>) =>
    updateDraft((d) => ({ ...d, brand: { ...d.brand, ...patch } }));

  return (
    <StepForm
      step="marca"
      validate={() => {
        const parsed = brandAnswersSchema.safeParse({
          logoAsset: brand.logoAsset ?? null,
          brandColors: colors,
          feelings: chosen,
        });
        return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Confira as respostas.");
      }}
    >
      {identityLocked && (
        <LockedNote>
          A identidade visual já foi aprovada: cores e sensações ficam como estão. Você ainda pode
          trocar o logo.
        </LockedNote>
      )}
      <SectionCard
        name="Logo"
        note="Opcional. Sem logo, a gente cria um monograma com o nome do negócio."
      >
        <div className="flex flex-wrap items-center gap-4">
          {brand.logoAsset && (
            <Thumb
              url={urls[brand.logoAsset]}
              alt="Logo enviado"
              removeLabel="Remover o logo"
              onRemove={() => {
                logo.discard(brand.logoAsset);
                set({ logoAsset: null });
              }}
            />
          )}
          <PickFiles
            label={brand.logoAsset ? "Trocar o logo" : "Enviar o logo"}
            disabled={logo.busy > 0}
            onFiles={(files) =>
              logo.upload(files.slice(0, 1), (assetId, url) => {
                logo.discard(brand.logoAsset);
                remember(assetId, url);
                set({ logoAsset: assetId });
              })
            }
          />
        </div>
        <UploadStatus busy={logo.busy} error={logo.error} />
      </SectionCard>

      <SectionCard
        name="Cores da marca"
        note="Opcional, até 3. A gente monta a paleta a partir delas e garante a leitura dos textos."
      >
        <fieldset disabled={identityLocked} className="flex flex-wrap items-center gap-3">
          <legend className="sr-only">Cores da marca</legend>
          {colors.map((color, index) => (
            <label
              // Colors have no ids and change while picking; the values are controlled.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              key={index}
              className="grid justify-items-center gap-1 text-sm text-ink-soft"
            >
              <input
                type="color"
                value={color}
                aria-label={`Cor ${index + 1}`}
                className="size-12 cursor-pointer rounded-lg border border-input bg-card p-1"
                onChange={(event) =>
                  set({
                    brandColors: colors.map((c, i) =>
                      i === index ? event.target.value.toUpperCase() : c,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="touch-target text-[0.8125rem] underline underline-offset-4"
                onClick={() => set({ brandColors: colors.filter((_, i) => i !== index) })}
              >
                Remover
              </button>
            </label>
          ))}
          {colors.length < 3 && (
            <button
              type="button"
              onClick={() => set({ brandColors: [...colors, "#2F6B3F"] })}
              className="inline-flex h-12 items-center rounded-lg border border-dashed border-line-strong px-4 text-[0.9375rem] font-semibold text-leaf-deep hover:border-leaf"
            >
              Adicionar cor
            </button>
          )}
        </fieldset>
      </SectionCard>

      <ChoiceGroup
        legend="Que sensação o site deve passar?"
        hint="Escolha até 2. Sem escolha, a gente usa o mais comum para o seu tipo de negócio."
      >
        <div className="grid gap-2">
          {feelings.map((feeling) => {
            const checked = chosen.includes(feeling);
            const full = !checked && chosen.length >= 2;
            return (
              <label
                key={feeling}
                className={cn(
                  chipClass({ checked }),
                  "h-auto min-h-12 cursor-pointer justify-start rounded-lg py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-leaf",
                  (full || identityLocked) && "opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  disabled={full || identityLocked}
                  onChange={() =>
                    set({
                      feelings: checked
                        ? chosen.filter((f) => f !== feeling)
                        : [...chosen, feeling],
                    })
                  }
                />
                {checked && (
                  <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.5} />
                )}
                {feelingText[feeling]}
              </label>
            );
          })}
        </div>
      </ChoiceGroup>
    </StepForm>
  );
}
