"use client";

import { suggestSubdomain } from "@brotasites/schema";
import { ArrowRight, Check } from "lucide-react";
import { useId, useState } from "react";
import { chipClass } from "@/components/shared/chip";
import { CREATE_HREF } from "@/components/site/nav";
import { DEMO_DEFAULT, DEMO_FONTS_HREF, type DemoType, demoTypes } from "@/content/demo";
import { cn } from "@/lib/utils";

// "Experimente aqui": the visitor types a name and picks a type, and a miniature of their
// site follows along. Nothing is saved; the button carries the name and type to the first
// question. It is a plain form, so without JavaScript it still submits (GET) and shows the
// Padaria do Zé miniature.

export function HeroDemo() {
  const [name, setName] = useState(DEMO_DEFAULT.name);
  const [typeId, setTypeId] = useState(DEMO_DEFAULT.type);
  const [fontsWanted, setFontsWanted] = useState(false);
  const fieldId = useId();
  const type = demoTypes.find((t) => t.id === typeId) ?? (demoTypes[0] as DemoType);
  const shownName = name.trim() || "Seu negócio";

  return (
    <form
      action={CREATE_HREF}
      method="get"
      className="relative grid w-full max-w-xl gap-4 rounded-2xl border border-line bg-card p-5 shadow-[0_40px_60px_-44px_rgb(20_36_27/0.6)] sm:p-6 lg:mx-0"
      aria-labelledby={`${fieldId}-title`}
    >
      {fontsWanted && <link rel="stylesheet" href={DEMO_FONTS_HREF} precedence="default" />}
      <p id={`${fieldId}-title`} className="tag text-[0.75rem] text-stem">
        Experimente aqui
      </p>

      <div className="grid gap-2">
        <label htmlFor={fieldId} className="text-[0.9375rem] font-semibold">
          Nome do seu negócio
        </label>
        <input
          id={fieldId}
          name="nome"
          value={name}
          maxLength={80}
          autoComplete="organization"
          onChange={(event) => setName(event.target.value)}
          className="h-12 w-full min-w-0 rounded-lg border border-input bg-card px-4 text-base text-ink outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/15"
        />
      </div>

      <fieldset className="grid gap-2.5">
        <legend className="mb-2.5 text-[0.9375rem] font-semibold">Tipo de negócio</legend>
        <div className="flex flex-wrap gap-2">
          {demoTypes.map((option) => {
            const checked = option.id === typeId;
            return (
              <label
                key={option.id}
                className={cn(
                  chipClass({ checked }),
                  "touch-target cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf",
                )}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={option.id}
                  checked={checked}
                  onChange={() => {
                    setTypeId(option.id);
                    setFontsWanted(true);
                  }}
                  className="sr-only"
                />
                {checked && <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />}
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <Miniature name={shownName} type={type} />
      <p className="sr-only" role="status">
        Prévia: {shownName}, {type.label.toLocaleLowerCase("pt-BR")}.
      </p>

      <p className="text-[0.8125rem] text-ink-soft">Nada é salvo aqui. É só uma amostra.</p>
      <button
        type="submit"
        className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_6px_16px_-8px_rgb(20_36_27/0.6)] transition-[transform,background-color] duration-150 hover:bg-leaf-deep active:scale-[0.97]"
      >
        Continuar com este site
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </button>
    </form>
  );
}

/** A small likeness of the client's site, in the colors and heading font of the type. */
function Miniature({ name, type }: { name: string; type: DemoType }) {
  const { primary, background, text } = type.colors;
  const address = `${suggestSubdomain(name) ?? "seu-negocio"}.brotasites.com`;
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-xl border border-line">
      <div className="flex h-7 items-center justify-center border-b border-line bg-paper">
        <span className="tag truncate px-3 normal-case tracking-[0.02em] text-ink-soft">
          {address}
        </span>
      </div>
      <div
        className="demo-site grid gap-2 px-5 pt-4 pb-5"
        style={{ backgroundColor: background, color: text }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span
            className="shrink-0 rounded-md px-2.5 py-1.5 text-[0.6875rem] font-semibold text-white"
            style={{ backgroundColor: primary }}
          >
            Fale conosco
          </span>
        </div>
        <p
          className="mt-4 text-[0.6875rem] font-semibold tracking-[0.14em] uppercase"
          style={{ color: primary }}
        >
          {type.label}
        </p>
        <p
          className="text-[1.875rem] leading-[1.04] sm:text-[2.125rem]"
          style={{ fontFamily: `"${type.font}", ui-serif, Georgia, serif` }}
        >
          {type.title}
        </p>
        <p className="text-[0.8125rem]">Texto de exemplo. No seu site, vai o que você escrever.</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span
            className="rounded-md px-3 py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: primary }}
          >
            Fale conosco →
          </span>
          <span
            className="rounded-lg border-[1.5px] bg-white px-2.5 py-1.5 text-xs"
            style={{ borderColor: primary, color: primary }}
          >
            ● Aberto agora
          </span>
        </div>
      </div>
    </div>
  );
}
