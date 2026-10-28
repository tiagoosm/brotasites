"use client";

import {
  contentAnswersSchema,
  type FormDraft,
  type PhotoAnswer,
  sectionsOf,
} from "@brotasites/schema/v1.2";
import { useId } from "react";
import { useForm12 } from "@/lib/form-store";
import { PickFiles, Thumb, UploadStatus, useAssetUrls, useUploader } from "./asset-upload";
import { ItemList, SectionCard, TextField } from "./fields";
import { StepForm } from "./step-form";

// Step 4: what the business offers, in the client's words. Prices and facts go to the site as
// typed; the AI only tidies the text. Blank rows are ignored. Photos need the consent of the
// people in them, and of a guardian when a minor appears.

type Content = NonNullable<FormDraft["content"]>;
type Service = NonNullable<Content["services"]>[number];
type Highlight = NonNullable<Content["highlights"]>[number];
type Question = NonNullable<Content["faq"]>[number];
type Testimonial = Partial<NonNullable<Content["testimonials"]>[number]>;

const MAX_PHOTOS = 12;
const filled = (...values: (string | undefined)[]) => values.some((value) => value?.trim());

/** The answers without blank rows, as the step checks them. */
export function cleanContent(content: Content) {
  return {
    services: (content.services ?? []).filter((s) => filled(s.name, s.description, s.price)),
    highlights: (content.highlights ?? []).filter((h) => filled(h.title, h.text)),
    faq: (content.faq ?? []).filter((q) => filled(q.question, q.answer)),
    testimonials: (content.testimonials ?? []).filter((t) => filled(t.name, t.text, t.context)),
    photos: content.photos ?? [],
  };
}

export function ContentStep() {
  const { draft, updateDraft } = useForm12();
  const content = draft.content ?? {};
  const on = new Set(sectionsOf(draft));
  const set = (patch: Partial<Content>) =>
    updateDraft((d) => ({ ...d, content: { ...d.content, ...patch } }));
  const rows = <T,>(items: T[] | undefined, empty: T) =>
    items && items.length > 0 ? items : [empty];

  return (
    <StepForm
      step="conteudo"
      validate={() => {
        const parsed = contentAnswersSchema.safeParse(cleanContent(content));
        return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Confira as respostas.");
      }}
    >
      {on.has("servicos") && (
        <SectionCard
          name="Serviços ou produtos"
          note="Até 9. O preço é opcional e vai para o site do jeito que você escrever."
        >
          <ItemList<Service>
            items={rows(content.services, { name: "" })}
            max={9}
            itemName="Serviço"
            addLabel="Adicionar serviço"
            newItem={() => ({ name: "" })}
            onChange={(services) => set({ services })}
            renderItem={(item, update, index) => (
              <>
                <TextField
                  label="Nome"
                  value={item.name}
                  maxLength={50}
                  placeholder={index === 0 ? "Ex.: Pão de fermentação natural" : undefined}
                  onChange={(name) => update({ name })}
                />
                <TextField
                  label="Descrição (opcional)"
                  value={item.description}
                  maxLength={200}
                  onChange={(description) => update({ description })}
                />
                <TextField
                  label="Preço (opcional)"
                  value={item.price}
                  maxLength={30}
                  placeholder="Ex.: R$ 12,90 ou a partir de R$ 50"
                  onChange={(price) => update({ price })}
                />
              </>
            )}
          />
        </SectionCard>
      )}

      {on.has("diferenciais") && (
        <SectionCard name="Diferenciais" note="Até 8, curtos. A seção aparece com pelo menos 3.">
          <ItemList<Highlight>
            items={rows(content.highlights, { title: "" })}
            max={8}
            itemName="Diferencial"
            addLabel="Adicionar diferencial"
            newItem={() => ({ title: "" })}
            onChange={(highlights) => set({ highlights })}
            renderItem={(item, update, index) => (
              <>
                <TextField
                  label="Título"
                  value={item.title}
                  maxLength={60}
                  placeholder={index === 0 ? "Ex.: Entrega no bairro" : undefined}
                  onChange={(title) => update({ title })}
                />
                <TextField
                  label="Detalhe (opcional)"
                  value={item.text}
                  maxLength={200}
                  onChange={(text) => update({ text })}
                />
              </>
            )}
          />
        </SectionCard>
      )}

      {on.has("faq") && (
        <SectionCard name="Perguntas frequentes" note="Opcional, até 10.">
          <ItemList<Question>
            items={rows(content.faq, { question: "", answer: "" })}
            max={10}
            itemName="Pergunta"
            addLabel="Adicionar pergunta"
            newItem={() => ({ question: "", answer: "" })}
            onChange={(faq) => set({ faq })}
            renderItem={(item, update) => (
              <>
                <TextField
                  label="Pergunta"
                  value={item.question}
                  maxLength={120}
                  onChange={(question) => update({ question })}
                />
                <TextField
                  label="Resposta"
                  multiline
                  value={item.answer}
                  maxLength={400}
                  onChange={(answer) => update({ answer })}
                />
              </>
            )}
          />
        </SectionCard>
      )}

      {on.has("depoimentos") && draft.business?.category !== "psicologia" && (
        <SectionCard
          name="Depoimentos"
          note="Só depoimentos reais, de clientes que autorizaram. A gente nunca inventa depoimentos."
        >
          <ItemList<Testimonial>
            items={rows(content.testimonials as Testimonial[] | undefined, { name: "", text: "" })}
            max={6}
            itemName="Depoimento"
            addLabel="Adicionar depoimento"
            newItem={() => ({ name: "", text: "" })}
            onChange={(testimonials) =>
              set({ testimonials: testimonials as Content["testimonials"] })
            }
            renderItem={(item, update) => (
              <>
                <TextField
                  label="Nome do cliente"
                  value={item.name}
                  maxLength={60}
                  onChange={(name) => update({ name })}
                />
                <TextField
                  label="Quem é (opcional)"
                  value={item.context}
                  maxLength={60}
                  placeholder="Ex.: cliente desde 2019"
                  onChange={(context) => update({ context })}
                />
                <TextField
                  label="Depoimento"
                  multiline
                  value={item.text}
                  maxLength={300}
                  onChange={(text) => update({ text })}
                />
                <Confirm
                  checked={item.authorized === true}
                  onChange={(authorized) => update({ authorized: authorized ? true : undefined })}
                >
                  Essa pessoa autorizou o uso do depoimento e do nome no site.
                </Confirm>
              </>
            )}
          />
        </SectionCard>
      )}

      <PhotosCard photos={content.photos ?? []} onChange={(photos) => set({ photos })} />
    </StepForm>
  );
}

function PhotosCard({
  photos,
  onChange,
}: {
  photos: PhotoAnswer[];
  onChange: (photos: PhotoAnswer[]) => void;
}) {
  const uploader = useUploader("image");
  const [urls, remember] = useAssetUrls(photos.map((photo) => photo.assetId));
  const room = MAX_PHOTOS - photos.length;
  const update = (index: number, patch: Partial<PhotoAnswer>) =>
    onChange(photos.map((photo, i) => (i === index ? { ...photo, ...patch } : photo)));

  return (
    <SectionCard
      name="Fotos"
      note="Até 12. Use fotos suas ou que você tem permissão para usar. Sem fotos, o site usa um topo tipográfico."
    >
      <details className="rounded-lg border border-border bg-paper p-4 text-[0.9375rem]">
        <summary className="cursor-pointer font-semibold">
          Como tirar boas fotos com o celular
        </summary>
        <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-ink-soft">
          <li>Use luz do dia, perto de uma janela ou na porta. Evite o flash.</li>
          <li>Segure o celular deitado para a foto do topo.</li>
          <li>Limpe a lente e arrume o fundo antes de fotografar.</li>
          <li>Mostre o trabalho de verdade: o balcão, o produto, as mãos fazendo.</li>
          <li>Prefira fotos com pelo menos 1200 pixels no lado maior.</li>
        </ul>
      </details>

      {photos.length > 0 && (
        <ol className="grid gap-3">
          {photos.map((photo, index) => (
            <li
              key={photo.assetId}
              className="grid gap-4 rounded-lg border border-border bg-paper p-4 sm:grid-cols-[6rem_minmax(0,1fr)]"
            >
              <Thumb
                url={urls[photo.assetId]}
                alt={photo.alt || `Foto ${index + 1}`}
                removeLabel={`Remover a foto ${index + 1}`}
                onRemove={() => {
                  uploader.discard(photo.assetId);
                  onChange(photos.filter((_, i) => i !== index));
                }}
              />
              <div className="grid gap-4">
                <TextField
                  label="O que aparece na foto"
                  value={photo.alt}
                  maxLength={160}
                  hint="Ajuda quem usa leitor de tela. Ex.: Balcão com pães e bolos."
                  onChange={(alt) => update(index, { alt })}
                />
                <UseField value={photo.use} onChange={(use) => update(index, { use })} />
                <Confirm
                  checked={photo.showsPeople === true}
                  onChange={(showsPeople) => update(index, { showsPeople })}
                >
                  Aparecem pessoas nesta foto
                </Confirm>
                {photo.showsPeople && (
                  <Confirm
                    checked={photo.peopleConsent === true}
                    onChange={(peopleConsent) => update(index, { peopleConsent })}
                  >
                    As pessoas da foto autorizaram o uso da imagem.
                  </Confirm>
                )}
                <Confirm
                  checked={photo.showsMinor === true}
                  onChange={(showsMinor) => update(index, { showsMinor })}
                >
                  Aparece alguma criança ou adolescente
                </Confirm>
                {photo.showsMinor && (
                  <Confirm
                    checked={photo.minorConsent === true}
                    onChange={(minorConsent) => update(index, { minorConsent })}
                  >
                    Os pais ou responsáveis autorizaram o uso da foto.
                  </Confirm>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {room > 0 ? (
        <PickFiles
          label={photos.length > 0 ? "Adicionar mais fotos" : "Enviar fotos"}
          multiple
          disabled={uploader.busy > 0}
          onFiles={(files) => {
            const added: PhotoAnswer[] = [];
            void uploader.upload(files.slice(0, room), (assetId, url) => {
              remember(assetId, url);
              added.push({ assetId, alt: "" });
              onChange([...photos, ...added]);
            });
          }}
        />
      ) : (
        <p className="text-sm text-ink-soft">Você chegou ao limite de {MAX_PHOTOS} fotos.</p>
      )}
      <UploadStatus busy={uploader.busy} error={uploader.error} />
    </SectionCard>
  );
}

const uses: { value: PhotoAnswer["use"] | ""; label: string }[] = [
  { value: "", label: "A gente escolhe" },
  { value: "hero", label: "Topo do site" },
  { value: "sobre", label: "Seção Sobre" },
  { value: "galeria", label: "Galeria" },
];

function UseField({
  value,
  onChange,
}: {
  value: PhotoAnswer["use"];
  onChange: (use: PhotoAnswer["use"]) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        Onde usar
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange((event.target.value || undefined) as PhotoAnswer["use"])}
        className="h-12 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base text-ink outline-none focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/15"
      >
        {uses.map((use) => (
          <option key={use.label} value={use.value}>
            {use.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Confirm({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[0.9375rem]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-leaf)]"
      />
      <span>{children}</span>
    </label>
  );
}
