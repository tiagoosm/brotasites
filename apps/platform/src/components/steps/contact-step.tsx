"use client";

import { formatPhone, formatZip, whatsappDigits } from "@brotasites/schema";
import {
  contactAnswersSchema,
  emailSchema,
  type FormDraft,
  familyInfo,
  familyOf,
  type OpeningHours,
  whatsappSchema,
} from "@brotasites/schema/v1.2";
import { useState } from "react";
import { useForm12 } from "@/lib/form-store";
import { Confirm } from "./content-step";
import { SectionCard, TextField } from "./fields";
import { defaultHours, HoursEditor } from "./hours-editor";
import { StepForm } from "./step-form";

// Step 5: how customers reach the business. Everything here is factual and goes to the site
// as typed; the form only tidies the format (digits, ZIP code, user names).

type Contact = NonNullable<FormDraft["contact"]>;

const digitsOf = (value: string) => value.replace(/\D/g, "");
const blank = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);
/** "@padariadoze" or "instagram.com/padariadoze/" → "padariadoze". */
const handle = (value: string, site: string) =>
  value
    .trim()
    .replace(new RegExp(`^(https?://)?(www\\.)?${site}\\.com/`, "i"), "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");

/** The answers as the step checks them: blanks dropped, hours defaulted. */
export function contactAnswers(contact: Contact) {
  return {
    ...contact,
    whatsapp: blank(contact.whatsapp),
    phone: blank(contact.phone),
    email: blank(contact.email),
    street: blank(contact.street),
    number: blank(contact.number),
    district: blank(contact.district),
    zip: blank(contact.zip),
    instagram: blank(contact.instagram),
    facebook: blank(contact.facebook),
    hasFixedAddress: contact.hasFixedAddress ?? true,
    serviceArea: contact.serviceArea ?? [],
    openingHours: contact.openingHours ?? defaultHours,
    registration:
      contact.registration?.council?.trim() || contact.registration?.number?.trim()
        ? contact.registration
        : undefined,
  };
}

export function ContactStep() {
  const { draft, updateDraft } = useForm12();
  const contact = draft.contact ?? {};
  const set = (patch: Partial<Contact>) =>
    updateDraft((d) => ({ ...d, contact: { ...d.contact, ...patch } }));
  const fixed = contact.hasFixedAddress ?? true;
  const family = familyOf(draft.business?.category);
  const needsRegistration = family ? familyInfo[family].requiresRegistration : false;

  return (
    <StepForm
      step="contato"
      validate={() => {
        const answers = contactAnswers(contact);
        if (
          needsRegistration &&
          !(answers.registration?.council?.trim() && answers.registration?.number?.trim())
        ) {
          return "Informe o registro profissional: o conselho e o número.";
        }
        const parsed = contactAnswersSchema.safeParse(answers);
        if (!parsed.success) return parsed.error.issues[0]?.message ?? "Confira as respostas.";
        if (!contact.openingHours || contact.hasFixedAddress === undefined) {
          set({ openingHours: answers.openingHours, hasFixedAddress: answers.hasFixedAddress });
        }
        return null;
      }}
    >
      <SectionCard name="Canais" note="Pelo menos um. O WhatsApp vira o botão principal do site.">
        <WhatsappField value={contact.whatsapp} onChange={(whatsapp) => set({ whatsapp })} />
        <div className="grid gap-5 sm:grid-cols-2">
          <PhoneField value={contact.phone} onChange={(phone) => set({ phone })} />
          <EmailField value={contact.email} onChange={(email) => set({ email })} />
        </div>
      </SectionCard>

      <SectionCard name="Onde fica" note="Com endereço, o site mostra um botão “Como chegar”.">
        <Confirm checked={!fixed} onChange={(none) => set({ hasFixedAddress: !none })}>
          Não tenho endereço fixo (atendo em domicílio ou on-line)
        </Confirm>
        {fixed ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,7rem)] gap-5">
              <TextField
                label="Rua"
                autoComplete="address-line1"
                value={contact.street}
                maxLength={120}
                placeholder="Ex.: Rua das Flores"
                onChange={(street) => set({ street })}
              />
              <TextField
                label="Número"
                value={contact.number}
                maxLength={20}
                onChange={(number) => set({ number })}
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] gap-5">
              <TextField
                label="Bairro"
                value={contact.district}
                maxLength={80}
                onChange={(district) => set({ district })}
              />
              <TextField
                label="CEP (opcional)"
                inputMode="numeric"
                autoComplete="postal-code"
                value={contact.zip}
                maxLength={9}
                placeholder="00000-000"
                onChange={(zip) => set({ zip: formatZip(zip) })}
              />
            </div>
          </>
        ) : (
          <ServiceAreaField
            value={contact.serviceArea ?? []}
            onChange={(serviceArea) => set({ serviceArea })}
          />
        )}
      </SectionCard>

      <SectionCard name="Horário de atendimento">
        <HoursEditor
          value={(contact.openingHours as OpeningHours | undefined) ?? defaultHours}
          onChange={(openingHours) => set({ openingHours })}
        />
      </SectionCard>

      <SectionCard name="Redes sociais" note="Opcional. Só o nome de usuário.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Instagram"
            value={contact.instagram}
            maxLength={60}
            placeholder="padariadoze"
            onChange={(value) => set({ instagram: handle(value, "instagram") })}
          />
          <TextField
            label="Facebook"
            value={contact.facebook}
            maxLength={60}
            placeholder="padariadoze"
            onChange={(value) => set({ facebook: handle(value, "facebook") })}
          />
        </div>
      </SectionCard>

      {needsRegistration && (
        <SectionCard
          name="Registro profissional"
          note="Obrigatório na sua área. Aparece no rodapé do site."
        >
          <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-5">
            <TextField
              label="Conselho"
              value={contact.registration?.council}
              maxLength={20}
              placeholder="Ex.: CRP 04"
              onChange={(council) =>
                set({ registration: { number: contact.registration?.number ?? "", council } })
              }
            />
            <TextField
              label="Número"
              value={contact.registration?.number}
              maxLength={30}
              onChange={(number) =>
                set({ registration: { council: contact.registration?.council ?? "", number } })
              }
            />
          </div>
        </SectionCard>
      )}
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

function PhoneField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (digits: string) => void;
}) {
  const [shown, setShown] = useState(() => formatPhone(value ?? ""));
  return (
    <TextField
      label="Telefone (opcional)"
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={shown}
      placeholder="(35) 3471-0000"
      maxLength={16}
      onChange={(typed) => {
        const formatted = formatPhone(typed);
        setShown(formatted);
        onChange(digitsOf(formatted));
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
      onChange={(typed) => onChange(typed.trim())}
    />
  );
}

/** Neighborhoods or cities served, typed as one line separated by commas. */
function ServiceAreaField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (areas: string[]) => void;
}) {
  const [shown, setShown] = useState(() => value.join(", "));
  return (
    <TextField
      label="Bairros ou cidades que você atende"
      value={shown}
      maxLength={400}
      placeholder="Ex.: Centro, Jardim América, Pouso Alegre"
      hint="Separe por vírgula. Até 10."
      onChange={(typed) => {
        setShown(typed);
        onChange(
          typed
            .split(",")
            .map((area) => area.trim())
            .filter((area) => area.length >= 2)
            .slice(0, 10),
        );
      }}
    />
  );
}
