"use client";

import {
  draftSections,
  moveSection,
  type SectionId,
  sectionInfo,
  toggleSection,
} from "@brotasites/schema";
import { ArrowDown, ArrowUp, Lock } from "lucide-react";
import { Switch } from "radix-ui";
import { useRef } from "react";
import { useDraft } from "@/lib/draft-store";
import { cn } from "@/lib/utils";
import { StepForm } from "./step-form";

const infoById = new Map(sectionInfo.map((info) => [info.id, info]));

export function SectionsStep() {
  const { draft, updateDraft } = useDraft();
  const sections = draftSections(draft);
  const listRef = useRef<HTMLOListElement>(null);

  // Testimonials must be real: the switch unlocks once the client adds one (question 5).
  const testimonials = sections.find((s) => s.id === "depoimentos")?.content?.items;
  const hasTestimonials = Array.isArray(testimonials) && testimonials.length > 0;

  function move(id: SectionId, delta: -1 | 1) {
    updateDraft((d) => moveSection(d, id, delta));
    // Keep focus on the same control after the row moves.
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLButtonElement>(`[data-move="${id}:${delta}"]:not(:disabled)`)
        ?.focus();
    });
  }

  return (
    <StepForm step="secoes">
      <ol
        ref={listRef}
        className="grid gap-2.5"
        aria-label="Partes do site, na ordem em que aparecem"
      >
        {sections.map((section, index) => {
          const info = infoById.get(section.id);
          if (!info) return null;
          const locked = Boolean(info.locked);
          const blocked = section.id === "depoimentos" && !hasTestimonials;
          const canMoveUp = !locked && index > 1;
          const canMoveDown = !locked && index < sections.length - 1;
          const switchId = `secao-${section.id}`;
          return (
            <li
              key={section.id}
              className={cn(
                "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 rounded-xl border bg-card p-4 transition-colors duration-200",
                section.enabled && !blocked
                  ? "border-input"
                  : "border-dashed border-border bg-paper",
              )}
            >
              <div className="min-w-0">
                <label htmlFor={switchId} className="text-[1.0625rem] font-semibold">
                  {info.name}
                </label>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {blocked
                    ? "Fica disponível quando você cadastrar um depoimento real, na pergunta 5."
                    : info.description}
                </p>
              </div>

              {locked ? (
                <span className="tag inline-flex items-center gap-1.5 text-ink-soft">
                  <Lock aria-hidden="true" className="size-3.5" />
                  Sempre aparece
                </span>
              ) : (
                <Switch.Root
                  id={switchId}
                  checked={section.enabled && !blocked}
                  disabled={blocked}
                  onCheckedChange={(enabled) =>
                    updateDraft((d) => toggleSection(d, section.id, enabled))
                  }
                  className="relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-line-strong transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-leaf"
                >
                  <Switch.Thumb className="block size-6 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-out)] data-[state=checked]:translate-x-[1.375rem]" />
                </Switch.Root>
              )}

              {!locked && (
                <div className="col-span-2 flex gap-2">
                  <MoveButton
                    direction="up"
                    name={info.name}
                    disabled={!canMoveUp}
                    data={`${section.id}:-1`}
                    onClick={() => move(section.id, -1)}
                  />
                  <MoveButton
                    direction="down"
                    name={info.name}
                    disabled={!canMoveDown}
                    data={`${section.id}:1`}
                    onClick={() => move(section.id, 1)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </StepForm>
  );
}

function MoveButton({
  direction,
  name,
  disabled,
  data,
  onClick,
}: {
  direction: "up" | "down";
  name: string;
  disabled: boolean;
  data: string;
  onClick: () => void;
}) {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  const label = direction === "up" ? "Subir" : "Descer";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-move={data}
      aria-label={`${label} ${name}`}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input px-3 text-sm text-ink-soft transition-[color,border-color,transform] duration-150 hover:border-ink-soft hover:text-ink active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}
