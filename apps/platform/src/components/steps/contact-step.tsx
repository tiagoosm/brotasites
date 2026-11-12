"use client";

import { formatPhone, formatZip, whatsappDigits } from "@brotasites/schema";
import {
  contactAnswersSchema,
  emailSchema,
  type FormDraft,
  familyInfo,
  familyOf,
  normalizeSocial,
  type OpeningHours,
  type SocialNetwork,
  socialProblem,
  whatsappSchema,
} from "@brotasites/schema/v1.2";
import { useState } from "react";
import { useForm12 } from "@/lib/form-store";
import { Confirm } from "./content-step";
import { SectionCard, TextField } from "./fields";
import { defaultHours, HoursEditor } from "./hours-editor";
import { SendButton, SendReview, useSendAnswers } from "./send-answers";
import { StepForm } from "./step-form";

// Step 5 of 5: how customers reach the business, then the answers are sent (E25). Everything here is factual and goes to the site
// as typed; the form only tidies the format (digits, ZIP code, user names).

type Contact = NonNullable<FormDraft["contact"]>;

const digitsOf = (value: string) => value.replace(/\D/g, "");
const blank = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

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
  const sender = useSendAnswers();
  // Moving on with a wrong social name shows the message next to its field too (E38).
  const [triedNext, setTriedNext] = useState(false);

  return (
    <StepForm
      step="contato"
      onDone={() => void sender.send()}
      action={<SendButton sender={sender} />}
      validate={() => {
        setTriedNext(true);
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
          <SocialField
            network="instagram"
            label="Instagram"
            value={contact.instagram}
            checkNow={triedNext}
            onChange={(instagram) => set({ instagram })}
          />
          <SocialField
            network="facebook"
            label="Facebook"
            value={contact.facebook}
            checkNow={triedNext}
            onChange={(facebook) => set({ facebook })}
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
      <SendReview sender={sender} />
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

/**
 * An Instagram or Facebook name (E38). The field keeps what is typed, letter by letter; a pasted
 * link or "@nome" becomes the name at once, and anything else is tidied when leaving the field.
 * The draft always gets the tidied name. What is wrong shows here on leaving the field or on
 * moving on, with the same words the server uses (packages/schema/src/v1.2/social.ts).
 */
function SocialField({
  network,
  label,
  value,
  checkNow,
  onChange,
}: {
  network: SocialNetwork;
  label: string;
  value: string | undefined;
  checkNow: boolean;
  onChange: (name: string) => void;
}) {
  const [shown, setShown] = useState(value ?? "");
  const [left, setLeft] = useState(false);
  const name = normalizeSocial(shown, network);
  const problem = name && (left || checkNow) ? socialProblem(name, network) : null;
  return (
    <TextField
      label={label}
      value={shown}
      maxLength={200}
      placeholder="padariadoze"
      hint="Só o nome de usuário, ou cole o link do perfil."
      error={problem ?? undefined}
      onBlur={() => {
        setLeft(true);
        setShown(name);
      }}
      onChange={(typed) => {
        // A paste (several characters at once, or a line break): show the name it holds.
        const pasted = typed.length - shown.length > 1 || /[\r\n]/.test(typed);
        setShown(pasted ? normalizeSocial(typed, network) : typed);
        setLeft(false);
        onChange(normalizeSocial(typed, network));
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
