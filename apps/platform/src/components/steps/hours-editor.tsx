"use client";

import { type HoursRule, type OpeningHours, type WeekDay, weekDays } from "@brotasites/schema/v1.2";
import { Plus, X } from "lucide-react";
import { useId } from "react";
import { chipClass } from "@/components/shared/chip";
import { cn } from "@/lib/utils";
import { TextField } from "./fields";

// Structured opening hours (docs/form-flow.md, step 5): groups of days with up to 3 intervals
// each, shortcuts for the usual weeks, "sob agendamento" and "24 horas".

const dayLabels: Record<WeekDay, string> = {
  mon: "Seg",
  tue: "Ter",
  wed: "Qua",
  thu: "Qui",
  fri: "Sex",
  sat: "Sáb",
  sun: "Dom",
};
const dayNames: Record<WeekDay, string> = {
  mon: "segunda",
  tue: "terça",
  wed: "quarta",
  thu: "quinta",
  fri: "sexta",
  sat: "sábado",
  sun: "domingo",
};

const shortcuts: [string, WeekDay[]][] = [
  ["Seg a Sex", ["mon", "tue", "wed", "thu", "fri"]],
  ["Seg a Sáb", ["mon", "tue", "wed", "thu", "fri", "sat"]],
  ["Todos os dias", [...weekDays]],
];

const modes: { value: OpeningHours["mode"]; label: string }[] = [
  { value: "schedule", label: "Tenho horário" },
  { value: "byAppointment", label: "Sob agendamento" },
  { value: "always", label: "24 horas" },
];

const newRule = (days: WeekDay[]): HoursRule => ({
  days,
  intervals: [{ open: "08:00", close: "18:00" }],
});

export const defaultHours: OpeningHours = {
  mode: "schedule",
  rules: [newRule(["mon", "tue", "wed", "thu", "fri"])],
};

export function HoursEditor({
  value,
  onChange,
}: {
  value: OpeningHours;
  onChange: (hours: OpeningHours) => void;
}) {
  const legend = useId();
  const used = new Set(value.rules.flatMap((rule) => rule.days));
  const free = weekDays.filter((day) => !used.has(day));
  const setRule = (index: number, rule: HoursRule) =>
    onChange({ ...value, rules: value.rules.map((r, i) => (i === index ? rule : r)) });

  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-3" aria-labelledby={legend}>
        <legend id={legend} className="text-[0.9375rem] font-semibold">
          Como você atende?
        </legend>
        <div className="flex flex-wrap gap-2">
          {modes.map((mode) => (
            <label
              key={mode.value}
              className={cn(
                chipClass({ checked: value.mode === mode.value }),
                "touch-target cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-leaf",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={`${legend}-mode`}
                checked={value.mode === mode.value}
                onChange={() =>
                  onChange({
                    ...value,
                    mode: mode.value,
                    rules:
                      mode.value === "schedule"
                        ? value.rules.length > 0
                          ? value.rules
                          : defaultHours.rules
                        : [],
                  })
                }
              />
              {mode.label}
            </label>
          ))}
        </div>
      </fieldset>

      {value.mode === "schedule" && (
        <ol className="grid gap-3">
          {value.rules.map((rule, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: rules have no ids; values are controlled
              key={index}
              className="grid gap-4 rounded-lg border border-border bg-paper p-4"
            >
              <RuleEditor
                rule={rule}
                index={index}
                taken={new Set(value.rules.filter((_, i) => i !== index).flatMap((r) => r.days))}
                onChange={(next) => setRule(index, next)}
                onRemove={
                  value.rules.length > 1
                    ? () => onChange({ ...value, rules: value.rules.filter((_, i) => i !== index) })
                    : undefined
                }
              />
              {free.length > 0 && (
                <button
                  type="button"
                  className="touch-target justify-self-start text-sm font-semibold text-leaf-deep underline underline-offset-4"
                  onClick={() =>
                    setRule(index, {
                      ...rule,
                      days: weekDays.filter((day) => rule.days.includes(day) || free.includes(day)),
                    })
                  }
                >
                  Copiar para os outros dias
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {value.mode === "schedule" && free.length > 0 && value.rules.length < 7 && (
        <button
          type="button"
          onClick={() =>
            onChange({ ...value, rules: [...value.rules, newRule([free[0] as WeekDay])] })
          }
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong text-[0.9375rem] font-semibold text-leaf-deep hover:border-leaf"
        >
          <Plus aria-hidden="true" className="size-4" />
          Adicionar outros dias com horário diferente
        </button>
      )}
      {value.mode === "schedule" && free.length > 0 && (
        <p className="text-sm text-ink-soft">
          Fechado: {free.map((day) => dayNames[day]).join(", ")}.
        </p>
      )}

      <TextField
        label="Observação (opcional)"
        value={value.note}
        maxLength={120}
        placeholder="Ex.: Feriados, consulte pelo WhatsApp."
        onChange={(note) => onChange({ ...value, note: note || undefined })}
      />
    </div>
  );
}

function RuleEditor({
  rule,
  index,
  taken,
  onChange,
  onRemove,
}: {
  rule: HoursRule;
  index: number;
  taken: Set<WeekDay>;
  onChange: (rule: HoursRule) => void;
  onRemove?: () => void;
}) {
  const toggle = (day: WeekDay) =>
    onChange({
      ...rule,
      days: rule.days.includes(day)
        ? rule.days.filter((d) => d !== day)
        : weekDays.filter((d) => d === day || rule.days.includes(d)),
    });
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="tag text-stem">Dias {index + 1}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover o grupo de dias ${index + 1}`}
            className="inline-flex size-8 items-center justify-center rounded-full text-ink-soft hover:bg-table hover:text-ink"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      <fieldset className="grid gap-3">
        <legend className="sr-only">Dias do grupo {index + 1}</legend>
        <div className="flex flex-wrap gap-2">
          {weekDays.map((day) => {
            const checked = rule.days.includes(day);
            const blocked = !checked && taken.has(day);
            return (
              <label
                key={day}
                title={blocked ? "Esse dia já está em outro grupo" : undefined}
                className={cn(
                  chipClass({ checked }),
                  "cursor-pointer px-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-leaf",
                  blocked && "cursor-not-allowed opacity-40",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  disabled={blocked}
                  onChange={() => toggle(day)}
                />
                <span aria-hidden="true">{dayLabels[day]}</span>
                <span className="sr-only">{dayNames[day]}</span>
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {shortcuts.map(([label, days]) => {
            const usable = days.filter((day) => !taken.has(day));
            return (
              <button
                key={label}
                type="button"
                className="touch-target text-sm font-semibold text-leaf-deep underline-offset-4 hover:underline"
                onClick={() => onChange({ ...rule, days: usable })}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-3">
        {rule.intervals.map((interval, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: intervals have no ids
            key={i}
            className="flex flex-wrap items-end gap-3"
          >
            <TimeField
              label={i === 0 ? "Abre" : `Abre de novo`}
              value={interval.open}
              onChange={(open) =>
                onChange({
                  ...rule,
                  intervals: rule.intervals.map((v, j) => (j === i ? { ...v, open } : v)),
                })
              }
            />
            <TimeField
              label="Fecha"
              value={interval.close}
              onChange={(close) =>
                onChange({
                  ...rule,
                  intervals: rule.intervals.map((v, j) => (j === i ? { ...v, close } : v)),
                })
              }
            />
            {rule.intervals.length > 1 && (
              <button
                type="button"
                aria-label={`Remover o horário ${i + 1}`}
                onClick={() =>
                  onChange({ ...rule, intervals: rule.intervals.filter((_, j) => j !== i) })
                }
                className="inline-flex size-12 items-center justify-center rounded-lg text-ink-soft hover:bg-table hover:text-ink"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
        ))}
        {rule.intervals.length < 3 && (
          <button
            type="button"
            className="touch-target justify-self-start text-sm font-semibold text-leaf-deep underline-offset-4 hover:underline"
            onClick={() =>
              onChange({
                ...rule,
                intervals: [...rule.intervals, { open: "14:00", close: "18:00" }],
              })
            }
          >
            Adicionar outro horário no mesmo dia (ex.: fecha para o almoço)
          </button>
        )}
      </div>
    </>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (time: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="time"
        value={value}
        step={300}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-lg border border-input bg-card px-3 text-base text-ink outline-none focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/15"
      />
    </div>
  );
}
