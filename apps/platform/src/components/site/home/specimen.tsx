import Image from "next/image";
import desktop from "../../../../public/specimen/desktop.png";
import phone from "../../../../public/specimen/phone.png";

// A herbarium sheet: the example site pressed onto paper, held by tape, with a specimen label.
// The pictures are the real template with the Padaria do Zé example (scripts/specimen.mjs).

function Tape({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute h-6 w-20 bg-[#efe6c6]/80 shadow-[0_1px_2px_rgb(20_36_27/0.12)] ${className}`}
    />
  );
}

export function Specimen() {
  return (
    <figure className="relative mx-auto w-full max-w-xl lg:mx-0">
      <div className="relative -rotate-1 rounded-sm bg-card p-3 shadow-[0_40px_60px_-44px_rgb(20_36_27/0.65)] ring-1 ring-line sm:p-4">
        <Tape className="-top-3 left-8 -rotate-6" />
        <Tape className="-top-3 right-10 rotate-3" />
        <div className="overflow-hidden rounded-sm border border-line">
          <div className="flex h-7 items-center justify-center border-b border-line bg-paper">
            <span className="tag normal-case tracking-[0.02em] text-ink-soft">
              padaria-do-ze.brotasites.com
            </span>
          </div>
          <Image
            src={desktop}
            alt="Site de exemplo da Padaria do Zé no computador: título Pão quentinho todo dia, botão Fale conosco e a placa de aberto ou fechado."
            sizes="(min-width: 1024px) 34rem, 92vw"
            priority
            className="h-auto w-full"
          />
        </div>
      </div>

      <div className="absolute -right-2 -bottom-10 w-[26%] rotate-2 rounded-[1.25rem] bg-ink p-1.5 shadow-[0_30px_40px_-24px_rgb(20_36_27/0.7)] sm:-right-6">
        <Image
          src={phone}
          alt="O mesmo site no celular."
          sizes="(min-width: 1024px) 9rem, 24vw"
          className="h-auto w-full rounded-[0.95rem]"
        />
      </div>

      <figcaption className="absolute -bottom-12 left-3 w-[15rem] rotate-[0.5deg] border border-line-strong bg-paper px-4 py-3 shadow-[0_12px_24px_-20px_rgb(20_36_27/0.6)] sm:left-6">
        <span className="tag block text-stem">Site de exemplo</span>
        <span className="mt-1 block font-display text-[1.125rem] leading-tight">Padaria do Zé</span>
        <span className="mt-1 block text-[0.8125rem] text-ink-soft">Sete perguntas, um site.</span>
      </figcaption>
    </figure>
  );
}
