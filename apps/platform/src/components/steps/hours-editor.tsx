"use client";

import { type OpeningHours, type WeekDay, weekDays } from "@brotasites/schema/v1.2";
import { Plus, X } from "lucide-react";
import { Switch } from "radix-ui";
import { useId, useState } from "react";
import { chipClass } from "@/components/shared/chip";
import {
  checkDay,
  copyDay,
  copyTargets,
  DEFAULT_INTERVAL,
  dayLong,
  expandRules,
  type Interval,
  overlapsAcrossDays,
  setDayOpen,
  type Week,
  weekSummary,
  withWeek,
} from "@/lib/hours-days";
import { cn } from "@/lib/utils";
import { TextField } from "./fields";

// Opening hours, day by day (docs/form-flow.md, step 5; E38). One card per day: open or closed
// and its own hours (up to 3). "Copiar para" only copies; each day can still be changed on its
// own. The draft keeps the schema's rules: days with the same hours share one rule
// (lib/hours-days.ts), so older drafts with groups of days open as they were.

const modes: { value: OpeningHours["mode"]; label: string }[] = [
  { value: "schedule", label: "Tenho horário" },
  { value: "byAppointment", label: "Sob agendamento" },
  { value: "always", label: "24 horas" },
];

export const defaultHours: OpeningHours = {
  mode: "schedule",
  rules: [{ days: ["mon", "tue", "wed", "thu", "fri"], intervals: [{ ...DEFAULT_INTERVAL }] }],
};

export function HoursEditor({
  value,
  onChange,
}: {
  value: OpeningHours;
  onChange: (hours: OpeningHours) => void;
}) {
  const legend = useId();
  const week = expandRules(value.rules);
  const setWeek = (next: Week) => onChange(withWeek(value, next));

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
        <>
          <ul aria-label="Horário de cada dia" className="grid gap-3">
            {weekDays.map((day) => (
              <DayCard key={day} day={day} week={week} onChange={setWeek} />
            ))}
          </ul>
          {overlapsAcrossDays(week) && (
            <p className="text-sm font-semibold text-destructive">
              Um horário que passa da meia-noite encontra o horário do dia seguinte. Ajuste um
              deles.
            </p>
          )}
          <p aria-live="polite" className="rounded-lg bg-table px-4 py-3 text-sm">
            <span className="font-semibold">Resumo: </span>
            {weekSummary(week)}.
          </p>
        </>
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

function DayCard({
  day,
  week,
  onChange,
}: {
  day: WeekDay;
  week: Week;
  onChange: (week: Week) => void;
}) {
  const nameId = useId();
  const [copying, setCopying] = useState(false);
  const intervals = week[day];
  const open = intervals !== null;
  const name = dayLong[day];
  const check = intervals ? checkDay(intervals) : null;
  const setIntervals = (next: Interval[]) => onChange({ ...week, [day]: next });

  return (
    <li
      aria-labelledby={nameId}
      className={cn(
        "grid gap-3 rounded-lg border p-3 sm:p-4",
        open ? "border-border bg-paper" : "border-dashed border-border bg-transparent",
      )}
    >
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span id={nameId} className="text-[0.9375rem] font-semibold">
          {name}
        </span>
        <span className="flex items-center gap-3">
          <span className={cn("text-sm", open ? "text-leaf-deep" : "text-ink-soft")} aria-hidden>
            {open ? "Aberto" : "Fechado"}
          </span>
          <Switch.Root
            checked={open}
            aria-label={`${name}: aberto`}
            onCheckedChange={(checked) => {
              setCopying(false);
              onChange(setDayOpen(week, day, checked));
            }}
            className="touch-target relative h-7 w-12 shrink-0 cursor-pointer rounded-full bg-line-strong transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf data-[state=checked]:bg-leaf motion-reduce:transition-none"
          >
            <Switch.Thumb className="block size-6 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-out)] data-[state=checked]:translate-x-[1.375rem] motion-reduce:transition-none" />
          </Switch.Root>
        </span>
      </div>

      {intervals && check && (
        <>
          <div className="grid gap-3">
            {intervals.map((interval, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: intervals have no ids
                key={i}
                className="grid gap-1.5"
              >
                <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem]">
                  <TimeField
                    label={i === 0 ? "Abre" : "Abre de novo"}
                    context={name}
                    value={interval.open}
                    invalid={check.same.includes(i) || check.overlap}
                    onChange={(time) =>
                      setIntervals(intervals.map((v, j) => (j === i ? { ...v, open: time } : v)))
                    }
                  />
                  <TimeField
                    label="Fecha"
                    context={name}
                    value={interval.close}
                    invalid={check.same.includes(i) || check.overlap}
                    onChange={(time) =>
                      setIntervals(intervals.map((v, j) => (j === i ? { ...v, close: time } : v)))
                    }
                  />
                  {/* On a phone the two times take the whole row; removing goes under them. */}
                  {intervals.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remover o horário ${i + 1} de ${name.toLowerCase()}`}
                      onClick={() => setIntervals(intervals.filter((_, j) => j !== i))}
                      className="col-span-2 inline-flex h-11 items-center justify-self-start gap-1.5 rounded-lg px-2 text-sm text-ink-soft hover:bg-table hover:text-ink sm:col-span-1 sm:size-11 sm:justify-center sm:px-0"
                    >
                      <X aria-hidden="true" className="size-4" />
                      <span className="sm:sr-only">Remover este horário</span>
                    </button>
                  ) : (
                    <span aria-hidden="true" className="hidden sm:block" />
                  )}
                </div>
                {check.same.includes(i) && (
                  <p className="text-sm text-destructive">
                    Abre e fecha no mesmo horário. Para atender o dia todo, use “24 horas”.
                  </p>
                )}
                {check.overnight.includes(i) && (
                  <p className="text-sm text-ink-soft">Fecha depois da meia-noite.</p>
                )}
              </div>
            ))}
            {check.overlap && (
              <p className="text-sm text-destructive">
                Dois horários de {name.toLowerCase()} se sobrepõem. Ajuste para um terminar antes do
                outro começar.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {intervals.length < 3 && (
              <button
                type="button"
                className="touch-target inline-flex items-center gap-1.5 text-left text-sm font-semibold text-leaf-deep underline-offset-4 hover:underline"
                onClick={() => setIntervals([...intervals, { open: "14:00", close: "18:00" }])}
              >
                <Plus aria-hidden="true" className="size-4" />
                Adicionar outro horário no mesmo dia (ex.: fecha para o almoço)
              </button>
            )}
            <button
              type="button"
              aria-expanded={copying}
              className="touch-target text-sm font-semibold text-leaf-deep underline-offset-4 hover:underline"
              onClick={() => setCopying((value) => !value)}
            >
              Copiar o horário de {name.toLowerCase()} para…
            </button>
          </div>

          {copying && (
            <fieldset className="grid gap-2">
              <legend className="sr-only">Copiar o horário de {name.toLowerCase()} para</legend>
              <div className="flex flex-wrap gap-2">
                {copyTargets.map(([label, days]) => (
                  <button
                    key={label}
                    type="button"
                    className={cn(chipClass({ checked: false }), "touch-target cursor-pointer")}
                    onClick={() => {
                      setCopying(false);
                      onChange(copyDay(week, day, days));
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-ink-soft">
                Só copia. Depois dá para mudar cada dia sozinho.
              </p>
            </fieldset>
          )}
        </>
      )}
    </li>
  );
}

function TimeField({
  label,
  context,
  value,
  invalid,
  onChange,
}: {
  label: string;
  /** The day, for screen readers: "Abre, segunda". */
  context: string;
  value: string;
  invalid: boolean;
  onChange: (time: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        <span className="sr-only">, {context.toLowerCase()}</span>
      </label>
      <input
        id={id}
        type="time"
        value={value}
        step={300}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-12 w-full min-w-0 rounded-lg border bg-card px-2 text-base sm:px-3 text-ink outline-none focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/15",
          invalid ? "border-destructive" : "border-input",
        )}
      />
    </div>
  );
}
