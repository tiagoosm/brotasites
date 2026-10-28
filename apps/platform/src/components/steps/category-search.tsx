"use client";

import { type CategoryInfo, categories, familyInfo } from "@brotasites/schema/v1.2";
import { Check, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { chipClass } from "@/components/shared/chip";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// The searchable category list of step 1 (docs/categories.md): type part of the name and pick
// from the matches. Native radio buttons, so keyboards and screen readers work as expected.

const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const MAX_SHOWN = 12;

export function CategorySearch({
  value,
  onChange,
  invalid,
}: {
  value: string | undefined;
  onChange: (id: string) => void;
  invalid?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const selected = categories.find((category) => category.id === value);
  const matches = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [] as CategoryInfo[];
    return categories
      .filter((category) => {
        const text = normalize(`${category.label} ${familyInfo[category.family].label}`);
        return words.every((word) => text.includes(word));
      })
      .slice(0, MAX_SHOWN);
  }, [query]);

  return (
    <div className="grid gap-3">
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        Tipo de negócio
      </label>
      {selected && (
        <p className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
          <span className={chipClass({ checked: true })}>
            <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
            {selected.label}
          </span>
          <span className="text-ink-soft">{familyInfo[selected.family].label}</span>
        </p>
      )}
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft"
        />
        <Input
          id={id}
          type="search"
          value={query}
          placeholder={selected ? "Buscar outro tipo" : "Ex.: padaria, barbearia, buffet"}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          className="pl-9"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {query.trim() !== "" && (
        <fieldset className="grid gap-2">
          <legend className="sr-only">Resultados da busca</legend>
          {matches.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Nenhum tipo com esse nome. Tente outra palavra ou escolha "Outro".
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {matches.map((category) => (
                <label
                  key={category.id}
                  className={cn(
                    chipClass({ checked: category.id === value }),
                    "touch-target cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf",
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-results`}
                    value={category.id}
                    checked={category.id === value}
                    onChange={() => {
                      onChange(category.id);
                      setQuery("");
                    }}
                    className="sr-only"
                  />
                  {category.label}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}
