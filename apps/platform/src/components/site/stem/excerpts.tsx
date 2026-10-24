import { type FormStepSlug, palettes, sectionInfo, templateOptions } from "@brotasites/schema";
import { Check, Lock } from "lucide-react";
import { chipClass } from "@/components/shared/chip";
import { cn } from "@/lib/utils";

// Small, still pictures of each question, made from the form's own pieces. They illustrate
// the text beside them, so they are hidden from screen readers.

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-2xl border border-line bg-card p-5 shadow-[0_24px_40px_-36px_rgb(20_36_27/0.55)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function BusinessExcerpt() {
  const types = ["Padaria", "Barbearia", "Salão de beleza", "Oficina mecânica", "Pet shop"];
  return (
    <Card>
      <p className="mb-3 text-sm font-semibold">Tipo de negócio</p>
      <div className="flex flex-wrap gap-2">
        {types.map((type, index) => (
          <span key={type} className={chipClass({ checked: index === 0 })}>
            {index === 0 && <Check className="size-3.5" strokeWidth={2.5} />}
            {type}
          </span>
        ))}
      </div>
    </Card>
  );
}

function TemplateExcerpt() {
  return (
    <Card className="grid gap-2.5">
      {templateOptions.slice(0, 2).map((option) => (
        <div
          key={option.id}
          className={cn(
            "rounded-xl border p-4",
            option.available ? "border-leaf bg-leaf-wash/60" : "border-input opacity-60",
          )}
        >
          <p className="flex items-center justify-between font-semibold">
            {option.name}
            <span className="tag text-ink-soft">{option.available ? "Escolhido" : "Em breve"}</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">{option.description}</p>
        </div>
      ))}
    </Card>
  );
}

function ColorsExcerpt() {
  return (
    <Card className="grid gap-2.5">
      {palettes.slice(0, 3).map((palette, index) => (
        <div
          key={palette.id}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3.5 py-3",
            index === 0 ? "border-leaf ring-2 ring-leaf/25" : "border-input",
          )}
        >
          <span className="flex">
            {[palette.background, palette.primary, palette.secondary, palette.text].map(
              (color, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed four swatches
                  key={i}
                  className="-ml-1.5 size-6 rounded-full border-2 border-card first:ml-0"
                  style={{ background: color }}
                />
              ),
            )}
          </span>
          <span className="font-semibold">{palette.name}</span>
          <span className="tag ml-auto text-ink-soft">{palette.primary}</span>
        </div>
      ))}
    </Card>
  );
}

function SectionsExcerpt() {
  const shown = ["hero", "sobre", "servicos", "depoimentos"] as const;
  return (
    <Card className="grid gap-2">
      {shown.map((id) => {
        const info = sectionInfo.find((s) => s.id === id);
        const on = id !== "depoimentos";
        return (
          <div
            key={id}
            className="flex items-center justify-between rounded-xl border border-input px-4 py-3"
          >
            <span className="font-semibold">{info?.name}</span>
            {info?.locked ? (
              <span className="tag inline-flex items-center gap-1.5 text-ink-soft">
                <Lock className="size-3.5" />
                Sempre aparece
              </span>
            ) : (
              <span
                className={cn(
                  "relative h-7 w-12 rounded-full transition-colors",
                  on ? "bg-leaf" : "bg-line-strong",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-6 rounded-full bg-white shadow-sm",
                    on ? "left-[1.375rem]" : "left-0.5",
                  )}
                />
              </span>
            )}
          </div>
        );
      })}
    </Card>
  );
}

function ContentExcerpt() {
  return (
    <Card>
      <p className="mb-2 text-sm font-semibold">Frase de apresentação</p>
      <div className="rounded-lg border border-leaf px-4 py-3 ring-4 ring-leaf/15">
        <span className="typing">Pão de fermentação natural, todo dia às 6h</span>
        <span className="caret" />
      </div>
      <p className="mt-2 text-right tag text-ink-soft">42/200</p>
    </Card>
  );
}

function ContactExcerpt() {
  return (
    <Card className="grid gap-3">
      <div className="flex items-center gap-3 rounded-xl border border-input px-4 py-3">
        <span className="font-semibold">Seg a Sex</span>
        <span className="text-ink-soft">06:00 - 19:00</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-paper p-3 text-sm">
        <span className="text-ink-soft">Agora o site mostraria:</span>
        <span className="inline-flex items-center gap-2 rounded-full bg-leaf-wash px-3 py-1 font-semibold text-leaf-deep">
          <span className="size-2 rounded-full bg-leaf" />
          Aberto agora
        </span>
        <span className="text-ink-soft">Fecha às 19:00</span>
      </div>
    </Card>
  );
}

function AddressExcerpt() {
  return (
    <Card>
      <div className="flex h-12 items-center rounded-lg border border-leaf px-4 font-mono text-[0.875rem] ring-4 ring-leaf/15">
        <span>padaria-do-ze</span>
        <span className="text-ink-soft">.brotasites.com</span>
      </div>
      <p className="mt-2.5 flex items-center gap-2 text-sm font-semibold text-leaf-deep">
        <Check className="size-4" />
        Disponível. Esse será o endereço do seu site.
      </p>
    </Card>
  );
}

export const excerpts: Record<FormStepSlug, () => React.ReactNode> = {
  negocio: BusinessExcerpt,
  modelo: TemplateExcerpt,
  cores: ColorsExcerpt,
  secoes: SectionsExcerpt,
  conteudo: ContentExcerpt,
  contato: ContactExcerpt,
  endereco: AddressExcerpt,
};
