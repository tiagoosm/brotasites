"use client";

import {
  brazilianStates,
  buildWeek,
  formatPhone,
  formatZip,
  localTime,
  type OpeningHoursRow,
  parseDays,
  parseHours,
  parseOpeningHours,
  setAddress,
  setContact,
  setOpeningHours,
  setSocial,
  statusAt,
  timeZoneForState,
  whatsappDigits,
  whatsappSchema,
} from "@brotasites/schema";
import { useEffect, useId, useState } from "react";
import { z } from "zod";
import { useDraft } from "@/lib/draft-store";
import { cn } from "@/lib/utils";
import { ItemList, SectionCard, TextField } from "./fields";
import { PhotosCard } from "./photos-card";
import { StepForm } from "./step-form";

// Question 6: how customers reach the business. Everything here is factual, so it goes to
// the site exactly as typed; the form only tidies the format (phone digits, ZIP code).

const emailSchema = z.email();

export function ContactStep() {
  const { draft, updateDraft } = useDraft();
  const contact = draft.business?.contact ?? {};
  const address = contact.address ?? {};
  const social = draft.business?.social ?? {};

  return (
    <StepForm step="contato">
      <SectionCard
        name="Contato"
        note="O WhatsApp aparece no botão flutuante e nos botões do site."
      >
        <WhatsappField
          value={contact.whatsapp}
          onChange={(whatsapp) => updateDraft((d) => setContact(d, { whatsapp }))}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Telefone (opcional)"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={contact.phone}
            placeholder="(35) 3471-0000"
            maxLength={20}
            onChange={(phone) => updateDraft((d) => setContact(d, { phone: formatPhone(phone) }))}
          />
          <EmailField
            value={contact.email}
            onChange={(email) => updateDraft((d) => setContact(d, { email }))}
          />
        </div>
      </SectionCard>

      <SectionCard
        name="Endereço"
        note="Aparece no site com o mapa. Deixe em branco o que não quiser mostrar."
      >
        <TextField
          label="Rua e número"
          autoComplete="street-address"
          value={address.street}
          placeholder="Ex.: Rua Direita, 120"
          maxLength={120}
          onChange={(street) => updateDraft((d) => setAddress(d, { street }))}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Bairro"
            value={address.district}
            maxLength={60}
            onChange={(district) => updateDraft((d) => setAddress(d, { district }))}
          />
          <TextField
            label="Cidade"
            autoComplete="address-level2"
            value={address.city}
            maxLength={60}
            onChange={(city) => updateDraft((d) => setAddress(d, { city }))}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-5">
          <StateField
            value={address.state}
            onChange={(state) => updateDraft((d) => setAddress(d, { state }))}
          />
          <TextField
            label="CEP"
            inputMode="numeric"
            autoComplete="postal-code"
            value={address.zip}
            placeholder="00000-000"
            maxLength={9}
            onChange={(zip) => updateDraft((d) => setAddress(d, { zip: formatZip(zip) }))}
          />
        </div>
      </SectionCard>

      <OpeningHoursCard
        rows={(contact.openingHours ?? []) as OpeningHoursRow[]}
        state={address.state}
        onChange={(rows) => updateDraft((d) => setOpeningHours(d, rows))}
      />

      <SectionCard name="Redes sociais" note="Opcional. Os links aparecem junto do contato.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Instagram"
            value={social.instagram ?? ""}
            placeholder="@seunegocio"
            maxLength={100}
            onChange={(instagram) => updateDraft((d) => setSocial(d, { instagram }))}
          />
          <TextField
            label="Facebook"
            value={social.facebook ?? ""}
            placeholder="facebook.com/seunegocio"
            maxLength={100}
            onChange={(facebook) => updateDraft((d) => setSocial(d, { facebook }))}
          />
        </div>
      </SectionCard>

      <PhotosCard />
    </StepForm>
  );
}

/** Typed as people write it; saved as digits with the country code. */
function WhatsappField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (digits: string) => void;
}) {
  const [shown, setShown] = useState(() => formatPhone(value ?? ""));
  const [checked, setChecked] = useState(false);
  const digits = whatsappDigits(shown);
  const invalid = checked && digits !== "" && !whatsappSchema.safeParse(digits).success;

  return (
    <TextField
      label="WhatsApp"
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={shown}
      placeholder="(35) 99999-0000"
      maxLength={16}
      hint="Com DDD, do jeito que você passa para os clientes."
      error={invalid ? "Confira o número com DDD, como (35) 99999-0000." : undefined}
      onBlur={() => setChecked(true)}
      onChange={(typed) => {
        const formatted = formatPhone(typed);
        setShown(formatted);
        onChange(whatsappDigits(formatted));
      }}
    />
  );
}

function EmailField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (email: string) => void;
}) {
  const [checked, setChecked] = useState(false);
  const email = value?.trim() ?? "";
  const invalid = checked && email !== "" && !emailSchema.safeParse(email).success;
  return (
    <TextField
      label="E-mail (opcional)"
      type="email"
      inputMode="email"
      autoComplete="email"
      value={value}
      placeholder="voce@exemplo.com"
      maxLength={120}
      error={invalid ? "Escreva um e-mail válido, como voce@exemplo.com." : undefined}
      onBlur={() => setChecked(true)}
      onChange={onChange}
    />
  );
}

function StateField({
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

const emptyRow = (): OpeningHoursRow => ({ days: "", hours: "" });

/**
 * Opening hours, one row per group of days. Each row says right away whether it was
 * understood, and the card shows the open/closed sign the site will display.
 */
function OpeningHoursCard({
  rows,
  state,
  onChange,
}: {
  rows: OpeningHoursRow[];
  state: string | undefined;
  onChange: (rows: OpeningHoursRow[]) => void;
}) {
  const filled = rows.filter((row) => row.days.trim() && row.hours.trim());

  return (
    <SectionCard
      name="Horários"
      note="Escreva como estaria na porta. Com os horários, o site mostra se está aberto agora."
    >
      <ItemList<OpeningHoursRow>
        items={rows.length ? rows : [emptyRow()]}
        max={8}
        itemName="Horário"
        addLabel="Adicionar horário"
        newItem={emptyRow}
        onChange={onChange}
        renderItem={(row, update, index) => {
          const daysUnclear = row.days.trim() !== "" && !parseDays(row.days);
          const hoursUnclear = row.hours.trim() !== "" && !parseHours(row.hours);
          const holiday = /feriado/i.test(row.days);
          return (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Dias"
                value={row.days}
                placeholder={index === 0 ? "Ex.: Seg a Sex" : undefined}
                maxLength={40}
                error={
                  daysUnclear && !holiday
                    ? "Use dias como “Seg a Sex”, “Sábado” ou “Todos os dias”."
                    : undefined
                }
                onChange={(days) => update({ days })}
              />
              <TextField
                label="Horário"
                value={row.hours}
                placeholder={index === 0 ? "Ex.: 08:00 - 18:00" : undefined}
                maxLength={40}
                error={
                  hoursUnclear
                    ? "Use horários como “08:00 - 18:00”, “8h às 12h e 14h às 18h” ou “Fechado”."
                    : undefined
                }
                onChange={(hours) => update({ hours })}
              />
            </div>
          );
        }}
      />
      <DoorSignPreview rows={filled} state={state} hasRows={filled.length > 0} />
    </SectionCard>
  );
}

/** The sign the site will show, computed with the business's clock. */
function DoorSignPreview({
  rows,
  state,
  hasRows,
}: {
  rows: OpeningHoursRow[];
  state: string | undefined;
  hasRows: boolean;
}) {
  // The clock is read after mounting, so server and browser render the same markup.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (!hasRows || !now) return null;
  const parsed = parseOpeningHours(rows);
  const { weekday, minute } = localTime(now, timeZoneForState(state));
  const status = parsed ? statusAt(buildWeek(parsed), weekday, minute) : null;

  return (
    <div role="status" className="rounded-lg border border-border bg-paper p-4 text-sm">
      {!parsed ? (
        <p className="text-ink-soft">
          Os horários aparecem no site do jeito que você escreveu, mas sem a placa de aberto ou
          fechado. Ajuste as linhas marcadas para ela aparecer.
        </p>
      ) : status ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-ink-soft">Agora o site mostraria:</span>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold",
              status.open ? "bg-leaf-wash text-leaf-deep" : "bg-table text-ink",
            )}
          >
            <span
              aria-hidden="true"
              className={cn("size-2 rounded-full", status.open ? "bg-leaf" : "bg-ink-soft")}
            />
            {status.label}
          </span>
          <span className="text-ink-soft">{status.detail}</span>
        </div>
      ) : (
        <p className="text-ink-soft">
          Hoje não está entre os dias informados, então a placa de aberto ou fechado não aparece
          hoje. Se fecha hoje, acrescente uma linha com “Fechado”.
        </p>
      )}
    </div>
  );
}
