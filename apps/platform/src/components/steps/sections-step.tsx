"use client";

import { type SectionId, sectionsOf } from "@brotasites/schema/v1.2";
import { Lock } from "lucide-react";
import { Switch } from "radix-ui";
import { useForm12 } from "@/lib/form-store";
import { cn } from "@/lib/utils";
import { StepForm } from "./step-form";

// Step 3: the parts of the site. The family's sections come on by default; the order is the
// design's. A section only shows when it has content: testimonials need a real one (step 4).

const choices: { id: SectionId; name: string; description: string; locked?: boolean }[] = [
  { id: "sobre", name: "Sobre", description: "A história do negócio e o que ele tem de especial." },
  {
    id: "servicos",
    name: "Serviços ou produtos",
    description: "O que você oferece, com uma linha sobre cada item.",
  },
  {
    id: "diferenciais",
    name: "Diferenciais",
    description: "Por que escolher você. Aparece com pelo menos 3.",
  },
  {
    id: "galeria",
    name: "Galeria de fotos",
    description: "Fotos do espaço, dos produtos ou do trabalho.",
  },
  {
    id: "depoimentos",
    name: "Depoimentos",
    description:
      "Opiniões reais de clientes, com autorização. Só aparece se você cadastrar pelo menos uma.",
  },
  {
    id: "faq",
    name: "Perguntas frequentes",
    description: "Respostas para as dúvidas que mais aparecem.",
  },
  { id: "cta-final", name: "Chamada final", description: "Um último convite para falar com você." },
  {
    id: "contato",
    name: "Contato",
    description: "Canais, endereço ou área atendida e horários.",
    locked: true,
  },
];

export function SectionsStep() {
  const { draft, updateDraft } = useForm12();
  const on = new Set(sectionsOf(draft));
  const psychology = draft.business?.category === "psicologia";

  function toggle(id: SectionId, enabled: boolean) {
    updateDraft((d) => {
      const current = new Set(sectionsOf(d));
      if (enabled) current.add(id);
      else current.delete(id);
      return { ...d, sections: [...current] };
    });
  }

  return (
    <StepForm step="secoes">
      <ul className="grid gap-2.5" aria-label="Partes do site">
        <li className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-input bg-card p-4">
          <div>
            <p className="text-[1.0625rem] font-semibold">Topo</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Nome, uma frase de apresentação e o botão principal.
            </p>
          </div>
          <Always />
        </li>
        {choices.map((choice) => {
          const unavailable = choice.id === "depoimentos" && psychology;
          const enabled = !unavailable && (choice.locked || on.has(choice.id));
          const switchId = `secao-${choice.id}`;
          return (
            <li
              key={choice.id}
              className={cn(
                "grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl border bg-card p-4 transition-colors duration-200",
                enabled ? "border-input" : "border-dashed border-border bg-paper",
              )}
            >
              <div className="min-w-0">
                <label htmlFor={switchId} className="text-[1.0625rem] font-semibold">
                  {choice.name}
                </label>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {unavailable
                    ? "Sites de psicologia não mostram depoimentos, pelas regras do conselho."
                    : choice.description}
                </p>
              </div>
              {choice.locked ? (
                <Always />
              ) : (
                <Switch.Root
                  id={switchId}
                  checked={enabled}
                  disabled={unavailable}
                  onCheckedChange={(value) => toggle(choice.id, value)}
                  className="relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-line-strong transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-leaf"
                >
                  <Switch.Thumb className="block size-6 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-out)] data-[state=checked]:translate-x-[1.375rem]" />
                </Switch.Root>
              )}
            </li>
          );
        })}
      </ul>
    </StepForm>
  );
}

function Always() {
  return (
    <span className="tag inline-flex items-center gap-1.5 text-ink-soft">
      <Lock aria-hidden="true" className="size-3.5" />
      Sempre aparece
    </span>
  );
}
