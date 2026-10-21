"use client";

import {
  buildPreviewConfig,
  contrastRatio,
  findCategory,
  findPairing,
  fontPairings,
  hexColorSchema,
  type Palette,
  palettes,
  setColor,
  setFonts,
  setPalette,
  setStyle,
} from "@brotasites/schema";
import { Check, TriangleAlert } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { useDraft } from "@/lib/draft-store";
import { cn } from "@/lib/utils";
import { ChoiceGroup, StepForm } from "./step-form";

// Samples render in the real typefaces, so this question loads them on demand.
const SAMPLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Lora:wght@400&family=Montserrat:wght@600&family=Playfair+Display:wght@400&family=Poppins:wght@400;600&family=Roboto:wght@400&family=Roboto+Slab:wght@400&display=swap";
const serif = new Set(["Playfair Display", "Lora", "Roboto Slab"]);

const choiceClass = (checked: boolean) =>
  cn(
    "cursor-pointer rounded-xl border transition-[border-color,box-shadow] duration-150",
    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf",
    checked ? "border-leaf ring-2 ring-leaf/25" : "border-input hover:border-ink-soft",
  );

export function DesignStep() {
  const { draft, updateDraft } = useDraft();
  const config = useMemo(() => buildPreviewConfig(draft), [draft]);
  const { colors, fonts } = config.design;
  const style = draft.design?.style ?? {};
  const preset = findCategory(draft.business?.category);
  const suggested = preset.palettes
    .map((id) => palettes.find((p) => p.id === id))
    .filter((p): p is (typeof palettes)[number] => Boolean(p));
  const others = palettes.filter((p) => !(preset.palettes as readonly string[]).includes(p.id));
  const paletteName = useId();
  const pairingName = useId();
  const currentPairing = findPairing(fonts.heading, fonts.body)?.id;
  const lowContrast = contrastRatio(colors.text, colors.background) < 4.5;

  return (
    <StepForm step="cores">
      <link rel="stylesheet" href={SAMPLE_FONTS} precedence="default" />

      <ChoiceGroup
        legend={`Paletas para ${preset.id === "outro" ? "o seu negócio" : preset.label.toLocaleLowerCase("pt-BR")}`}
      >
        <PaletteGrid
          palettes={suggested}
          name={paletteName}
          current={draft.design?.paletteId}
          onChoose={(id) => updateDraft((d) => setPalette(d, id))}
        />
        <details className="group mt-1">
          <summary className="cursor-pointer list-none text-[0.9375rem] font-semibold text-leaf-deep underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
            Ver mais {others.length} paletas
          </summary>
          <div className="mt-4">
            <PaletteGrid
              palettes={others}
              name={paletteName}
              current={draft.design?.paletteId}
              onChoose={(id) => updateDraft((d) => setPalette(d, id))}
            />
          </div>
        </details>
      </ChoiceGroup>

      <ChoiceGroup legend="Suas cores" hint="Ajuste qualquer cor. A paleta deixa de ser a pronta.">
        <div className="grid grid-cols-2 gap-3">
          <ColorField
            label="Destaque"
            hint="Botões e links"
            value={colors.primary}
            onChange={(v) => updateDraft((d) => setColor(d, "primary", v))}
          />
          <ColorField
            label="Faixa"
            hint="Chamada final"
            value={colors.secondary ?? colors.primary}
            onChange={(v) => updateDraft((d) => setColor(d, "secondary", v))}
          />
          <ColorField
            label="Fundo"
            hint="Cor da página"
            value={colors.background}
            onChange={(v) => updateDraft((d) => setColor(d, "background", v))}
          />
          <ColorField
            label="Texto"
            hint="Cor das letras"
            value={colors.text}
            onChange={(v) => updateDraft((d) => setColor(d, "text", v))}
          />
        </div>
        {lowContrast && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg bg-pollen/20 p-3 text-sm text-ink"
          >
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />O texto pode
            ficar difícil de ler sobre esse fundo. Escolha um fundo mais claro ou um texto mais
            escuro.
          </p>
        )}
      </ChoiceGroup>

      <ChoiceGroup
        legend="Fontes"
        hint="A primeira linha mostra a fonte dos títulos; a segunda, a do texto."
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {fontPairings.map((pairing) => {
            const checked = currentPairing === pairing.id;
            return (
              <label
                key={pairing.id}
                className={cn(choiceClass(checked), "relative grid gap-1 bg-card p-4")}
              >
                <input
                  type="radio"
                  name={pairingName}
                  value={pairing.id}
                  checked={checked}
                  onChange={() => updateDraft((d) => setFonts(d, pairing.heading, pairing.body))}
                  className="sr-only"
                />
                <span
                  className="truncate text-[1.375rem] leading-tight"
                  style={{
                    fontFamily: `"${pairing.heading}"`,
                    fontWeight: serif.has(pairing.heading) ? 400 : 600,
                  }}
                >
                  {config.business.name}
                </span>
                <span className="text-sm text-ink-soft" style={{ fontFamily: `"${pairing.body}"` }}>
                  {pairing.name} · {pairing.heading}
                  {pairing.body !== pairing.heading ? ` e ${pairing.body}` : ""}
                </span>
                {checked && <CheckBadge />}
              </label>
            );
          })}
        </div>
      </ChoiceGroup>

      <ChoiceGroup legend="Acabamento">
        <Segmented
          label="Cantos"
          value={style.borderRadius ?? "soft"}
          options={[
            ["none", "Retos"],
            ["soft", "Suaves"],
            ["round", "Redondos"],
          ]}
          onChange={(value) =>
            updateDraft((d) => setStyle(d, "borderRadius", value as "none" | "soft" | "round"))
          }
        />
        <Segmented
          label="Botões"
          value={style.buttons ?? "filled"}
          options={[
            ["filled", "Preenchidos"],
            ["outline", "Só contorno"],
          ]}
          onChange={(value) =>
            updateDraft((d) => setStyle(d, "buttons", value as "filled" | "outline"))
          }
        />
      </ChoiceGroup>
    </StepForm>
  );
}

function CheckBadge() {
  return (
    <span className="absolute top-2.5 right-2.5 inline-flex size-6 items-center justify-center rounded-full bg-leaf text-white">
      <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
    </span>
  );
}

function PaletteGrid({
  palettes: list,
  name,
  current,
  onChoose,
}: {
  palettes: readonly Palette[];
  name: string;
  current: string | undefined;
  onChoose: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {list.map((palette) => {
        const checked = current === palette.id;
        return (
          <label
            key={palette.id}
            className={cn(choiceClass(checked), "relative overflow-hidden bg-card")}
          >
            <input
              type="radio"
              name={name}
              value={palette.id}
              checked={checked}
              onChange={() => onChoose(palette.id)}
              className="sr-only"
            />
            <span
              className="flex h-16 flex-col justify-end gap-1.5 p-2.5"
              style={{ background: palette.background }}
              aria-hidden="true"
            >
              <span className="text-lg leading-none font-semibold" style={{ color: palette.text }}>
                Aa
              </span>
              <span className="flex gap-1">
                <span className="h-2.5 w-7 rounded-full" style={{ background: palette.primary }} />
                <span
                  className="h-2.5 w-4 rounded-full"
                  style={{ background: palette.secondary }}
                />
              </span>
            </span>
            <span className="block px-2.5 py-2 text-sm">{palette.name}</span>
            {checked && <CheckBadge />}
          </label>
        );
      })}
    </div>
  );
}

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value.toUpperCase());
  useEffect(() => setText(value.toUpperCase()), [value]);
  const valid = hexColorSchema.safeParse(text).success;

  return (
    // min-w-0: grid items otherwise refuse to shrink below the text input's natural width.
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label} <span className="font-normal text-ink-soft">· {hint}</span>
      </label>
      <div
        className={cn(
          "flex h-12 items-center gap-2 rounded-lg border bg-card pr-3 pl-1.5 focus-within:border-leaf focus-within:ring-4 focus-within:ring-leaf/15",
          valid ? "border-input" : "border-destructive",
        )}
      >
        <input
          type="color"
          aria-label={`Escolher a cor: ${label}`}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="size-9 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
        />
        <input
          id={id}
          value={text}
          spellCheck={false}
          maxLength={7}
          size={7}
          aria-invalid={!valid || undefined}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            setText(next);
            if (hexColorSchema.safeParse(next).success) onChange(next);
          }}
          className="tag min-w-0 flex-1 bg-transparent text-[0.8125rem] text-ink outline-none"
        />
      </div>
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-3">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="text-[0.9375rem]">
        {label}
      </span>
      <span className="inline-flex rounded-full border border-border bg-card p-[3px] text-sm">
        {options.map(([optionValue, optionLabel]) => (
          <label
            key={optionValue}
            className={cn(
              "cursor-pointer rounded-full px-3.5 py-1.5 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-leaf",
              value === optionValue
                ? "bg-ink font-semibold text-white"
                : "text-ink-soft hover:text-ink",
            )}
          >
            <input
              type="radio"
              name={name}
              value={optionValue}
              checked={value === optionValue}
              onChange={() => onChange(optionValue)}
              className="sr-only"
            />
            {optionLabel}
          </label>
        ))}
      </span>
    </fieldset>
  );
}
