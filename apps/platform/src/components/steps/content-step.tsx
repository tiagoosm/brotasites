"use client";

import {
  type Cta,
  type DraftSection,
  draftSections,
  iconSvg,
  PLACEHOLDER_NAME,
  placeholderContent,
  type SectionId,
  sectionInfo,
  serviceIcons,
  setSectionContent,
  setTestimonials,
  type Testimonial,
} from "@brotasites/schema";
import { useId } from "react";
import { useDraft } from "@/lib/draft-store";
import { cn } from "@/lib/utils";
import { ItemList, SectionCard, TextField } from "./fields";
import { StepForm } from "./step-form";

// Question 5: the words of each part of the site, in the order the client chose. Blank
// fields keep the example text in the preview, so the site never looks empty while typing.

const infoById = new Map(sectionInfo.map((info) => [info.id, info]));

type Content = Record<string, unknown>;
interface Service {
  name: string;
  description?: string;
  icon?: string | null;
}
interface Question {
  question: string;
  answer: string;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const list = <T,>(value: unknown, empty: T): T[] =>
  Array.isArray(value) && value.length ? (value as T[]) : [empty];

export function ContentStep() {
  const { draft, updateDraft } = useDraft();
  const name = draft.business?.name?.trim() || PLACEHOLDER_NAME;
  const sections = draftSections(draft).filter(shown);

  return (
    <StepForm step="conteudo">
      {sections.map((section) => {
        const content: Content = section.content ?? {};
        const example = placeholderContent(section.id, name) as Content;
        const set = (patch: Content) => updateDraft((d) => setSectionContent(d, section.id, patch));
        const title = (maxLength: number, hint?: string) => (
          <TextField
            label="Título"
            value={text(content.title)}
            placeholder={text(example.title)}
            maxLength={maxLength}
            hint={hint}
            onChange={(value) => set({ title: value })}
          />
        );
        return (
          <SectionCard
            key={section.id}
            name={infoById.get(section.id)?.name ?? section.id}
            note={notes[section.id]}
          >
            {fieldsFor(section.id)}
          </SectionCard>
        );

        function fieldsFor(id: SectionId) {
          switch (id) {
            case "hero":
              return (
                <>
                  {title(80, "Em branco, o topo mostra o nome do negócio.")}
                  <TextField
                    label="Frase de apresentação"
                    multiline
                    value={text(content.subtitle)}
                    placeholder={text(example.subtitle)}
                    maxLength={200}
                    onChange={(value) => set({ subtitle: value })}
                  />
                  <ButtonFields
                    cta={content.cta as Partial<Cta> | undefined}
                    example={example.cta as Cta}
                    onChange={(cta) => set({ cta })}
                  />
                </>
              );
            case "sobre":
              return (
                <>
                  {title(60)}
                  <TextField
                    label="Texto"
                    multiline
                    value={text(content.text)}
                    placeholder={text(example.text)}
                    maxLength={800}
                    onChange={(value) => set({ text: value })}
                  />
                </>
              );
            case "servicos":
              return (
                <>
                  {title(60)}
                  <ItemList<Service>
                    items={list(content.items, { name: "", description: "" })}
                    max={9}
                    itemName="Serviço"
                    addLabel="Adicionar serviço"
                    newItem={() => ({ name: "", description: "" })}
                    onChange={(items) => set({ items })}
                    renderItem={(item, update, index) => (
                      <>
                        <TextField
                          label="Nome"
                          value={item.name}
                          placeholder={index === 0 ? "Ex.: Pão de fermentação natural" : undefined}
                          maxLength={50}
                          onChange={(value) => update({ name: value })}
                        />
                        <TextField
                          label="Descrição"
                          value={item.description}
                          placeholder="Uma linha sobre o serviço"
                          maxLength={200}
                          onChange={(value) => update({ description: value })}
                        />
                        <IconPicker
                          label={`Ícone do serviço ${index + 1}`}
                          value={item.icon ?? "star"}
                          onChange={(icon) => update({ icon })}
                        />
                      </>
                    )}
                  />
                </>
              );
            case "galeria":
              return title(60);
            case "depoimentos":
              return (
                <>
                  {title(60)}
                  <ItemList<Testimonial>
                    items={list(content.items, { name: "", role: "", text: "" })}
                    max={6}
                    itemName="Depoimento"
                    addLabel="Adicionar depoimento"
                    newItem={() => ({ name: "", role: "", text: "" })}
                    onChange={(items) => updateDraft((d) => setTestimonials(d, items))}
                    renderItem={(item, update) => (
                      <>
                        <TextField
                          label="O que a pessoa disse"
                          multiline
                          value={item.text}
                          maxLength={300}
                          onChange={(value) => update({ text: value })}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <TextField
                            label="Nome"
                            value={item.name}
                            placeholder="Ex.: Maria S."
                            maxLength={60}
                            onChange={(value) => update({ name: value })}
                          />
                          <TextField
                            label="Quem é (opcional)"
                            value={item.role}
                            placeholder="Ex.: Cliente desde 2019"
                            maxLength={60}
                            onChange={(value) => update({ role: value })}
                          />
                        </div>
                      </>
                    )}
                  />
                </>
              );
            case "faq":
              return (
                <>
                  {title(60)}
                  <ItemList<Question>
                    items={list(content.items, { question: "", answer: "" })}
                    max={10}
                    itemName="Pergunta"
                    addLabel="Adicionar pergunta"
                    newItem={() => ({ question: "", answer: "" })}
                    onChange={(items) => set({ items })}
                    renderItem={(item, update, index) => (
                      <>
                        <TextField
                          label="Pergunta"
                          value={item.question}
                          placeholder={index === 0 ? "Ex.: Vocês fazem entrega?" : undefined}
                          maxLength={120}
                          onChange={(value) => update({ question: value })}
                        />
                        <TextField
                          label="Resposta"
                          multiline
                          value={item.answer}
                          maxLength={400}
                          onChange={(value) => update({ answer: value })}
                        />
                      </>
                    )}
                  />
                </>
              );
            case "cta-final":
              return (
                <>
                  {title(80)}
                  <TextField
                    label="Frase"
                    value={text(content.subtitle)}
                    placeholder={text(example.subtitle)}
                    maxLength={160}
                    onChange={(value) => set({ subtitle: value })}
                  />
                  <ButtonFields
                    cta={content.cta as Partial<Cta> | undefined}
                    example={example.cta as Cta}
                    onChange={(cta) => set({ cta })}
                  />
                </>
              );
            case "contato":
              return title(60);
          }
        }
      })}
    </StepForm>
  );
}

/**
 * Sections switched on in question 4. Testimonials also show while there is none yet,
 * since adding the first real one is what turns that section on.
 */
function shown(section: DraftSection): boolean {
  if (section.enabled) return true;
  if (section.id !== "depoimentos") return false;
  const items = section.content?.items;
  return !Array.isArray(items) || !items.some((item: Testimonial) => item.name?.trim());
}

const notes: Partial<Record<SectionId, React.ReactNode>> = {
  galeria: "As fotos entram na próxima pergunta.",
  depoimentos: (
    <>
      Só opiniões reais, com a permissão de quem escreveu. A seção aparece no site quando houver
      pelo menos uma com nome e texto.
    </>
  ),
  contato: "Endereço, horários e WhatsApp entram na próxima pergunta.",
};

const actions: { id: Cta["action"]; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "phone", label: "Ligação" },
  { id: "scroll", label: "Contato no site" },
  { id: "link", label: "Outro site" },
];

/** A button: its words and where it leads. */
function ButtonFields({
  cta = {},
  example,
  onChange,
}: {
  cta?: Partial<Cta>;
  example: Cta;
  onChange: (cta: Partial<Cta>) => void;
}) {
  const name = useId();
  const action = cta.action ?? example.action;
  const target = cta.target ?? "";
  const badLink = action === "link" && target.trim() !== "" && !/^https?:\/\/\S+$/i.test(target);

  return (
    <div className="grid gap-4">
      <TextField
        label="Texto do botão"
        value={cta.label}
        placeholder={example.label}
        maxLength={30}
        onChange={(label) => onChange({ ...cta, label })}
      />
      <fieldset className="grid gap-2.5">
        <legend className="mb-2.5 text-[0.9375rem] font-semibold">O botão leva para</legend>
        <div className="flex flex-wrap gap-2">
          {actions.map((option) => {
            const checked = action === option.id;
            return (
              <label
                key={option.id}
                className={cn(
                  "inline-flex h-10 cursor-pointer items-center rounded-full border px-4 text-[0.9375rem] transition-[background-color,border-color,color] duration-150 select-none",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf",
                  checked
                    ? "border-leaf bg-leaf-wash font-semibold text-leaf-deep"
                    : "border-input bg-card text-ink hover:border-ink-soft",
                )}
              >
                <input
                  type="radio"
                  name={name}
                  value={option.id}
                  checked={checked}
                  onChange={() =>
                    onChange({
                      ...cta,
                      action: option.id,
                      target: option.id === "scroll" ? "contato" : null,
                    })
                  }
                  className="sr-only"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      {action === "link" && (
        <TextField
          label="Endereço do site"
          type="url"
          inputMode="url"
          value={target}
          placeholder="https://"
          maxLength={300}
          error={badLink ? "Use um endereço que comece com http:// ou https://." : undefined}
          onChange={(value) => onChange({ ...cta, target: value })}
        />
      )}
      {action === "whatsapp" || action === "phone" ? (
        <p className="-mt-1 text-sm text-ink-soft">
          O número você informa na próxima pergunta, uma vez só para o site todo.
        </p>
      ) : null}
    </div>
  );
}

function IconPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (icon: string) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2.5 text-[0.9375rem] font-semibold">
        Ícone <span className="sr-only">· {label}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {serviceIcons.map((icon) => {
          const checked = value === icon.id;
          return (
            <label
              key={icon.id}
              title={icon.label}
              className={cn(
                "inline-flex size-11 cursor-pointer items-center justify-center rounded-full border transition-[background-color,border-color,color] duration-150",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf",
                checked
                  ? "border-leaf bg-leaf-wash text-leaf-deep"
                  : "border-input bg-card text-ink-soft hover:border-ink-soft hover:text-ink",
              )}
            >
              <input
                type="radio"
                name={name}
                value={icon.id}
                checked={checked}
                onChange={() => onChange(icon.id)}
                className="sr-only"
                aria-label={icon.label}
              />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="size-5"
                // Fixed icon markup from @brotasites/schema, never user input.
                // biome-ignore lint/security/noDangerouslySetInnerHtml: see above
                dangerouslySetInnerHTML={{ __html: iconSvg(icon.id) }}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
