import type { FormStepSlug12 } from "@brotasites/schema/v1.2";
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

function BrandExcerpt() {
  const feelings = ["Acolhedor", "Elegante", "Moderno", "Robusto", "Ousado"];
  return (
    <Card className="grid gap-4">
      <div className="flex items-center gap-2">
        {["#B45309", "#F5E6CC", "#3F2A1D"].map((color) => (
          <span
            key={color}
            className="size-9 rounded-lg border border-line"
            style={{ background: color }}
          />
        ))}
        <span className="ml-2 text-sm text-ink-soft">Cores da marca</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {feelings.map((feeling, index) => (
          <span key={feeling} className={chipClass({ checked: index === 0 })}>
            {index === 0 && <Check className="size-3.5" strokeWidth={2.5} />}
            {feeling}
          </span>
        ))}
      </div>
    </Card>
  );
}

function SectionsExcerpt() {
  const shown = [
    { name: "Topo", locked: true, on: true },
    { name: "Serviços", on: true },
    { name: "Galeria de fotos", on: true },
    { name: "Depoimentos", on: false },
  ];
  return (
    <Card className="grid gap-2">
      {shown.map((info) => {
        const on = info.on;
        return (
          <div
            key={info.name}
            className="flex items-center justify-between rounded-xl border border-input px-4 py-3"
          >
            <span className="font-semibold">{info.name}</span>
            {info.locked ? (
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
      <p className="mb-2 text-sm font-semibold">Descrição do serviço</p>
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
      <div className="flex flex-wrap gap-1.5">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day, index) => (
          <span key={day} className={cn(chipClass({ checked: index < 5 }), "px-3")}>
            {day}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-input px-4 py-3">
        <span className="font-semibold">06:00 às 19:00</span>
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

function DirectionExcerpt() {
  const directions = [
    { name: "Fiel à marca", colors: ["#B45309", "#FFF7EC"] },
    { name: "Evolução", colors: ["#1F5130", "#F4F1E8"] },
    { name: "Contraste", colors: ["#2B2350", "#F3F0FA"] },
  ];
  return (
    <Card className="grid grid-cols-3 gap-2.5">
      {directions.map((direction, index) => (
        <div
          key={direction.name}
          className={cn(
            "grid gap-2 rounded-xl border p-2.5",
            index === 1 ? "border-leaf ring-2 ring-leaf/25" : "border-input",
          )}
        >
          <div
            className="grid h-16 content-end gap-1 rounded-md p-2"
            style={{ background: direction.colors[1] }}
          >
            <span
              className="h-1.5 w-3/4 rounded-full"
              style={{ background: direction.colors[0] }}
            />
            <span
              className="h-1.5 w-1/2 rounded-full opacity-50"
              style={{ background: direction.colors[0] }}
            />
          </div>
          <span className="text-[0.8125rem] leading-tight font-semibold">{direction.name}</span>
        </div>
      ))}
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
        Disponível.
      </p>
    </Card>
  );
}

export const excerpts: Record<FormStepSlug12, () => React.ReactNode> = {
  negocio: BusinessExcerpt,
  marca: BrandExcerpt,
  secoes: SectionsExcerpt,
  conteudo: ContentExcerpt,
  contato: ContactExcerpt,
  direcao: DirectionExcerpt,
  endereco: AddressExcerpt,
};
