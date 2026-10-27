import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SplitWords } from "@/components/site/split-words";
import { ExampleFrame } from "./example-frame";

// "Veja um site de verdade": the example site (Padaria do Zé, built by the real generator,
// see scripts/build-example.mjs) in a browser frame. On wide screens the frame starts at the
// width of the text and grows to almost the whole screen as the visitor scrolls (CSS
// scroll-driven animation in globals.css; it follows the scroll and never holds it). The
// frame is a picture of the site: the page inside is inert, and the link below opens it.

export function ExampleShowcase() {
  return (
    <section
      aria-labelledby="exemplo-titulo"
      className="border-t border-line bg-table pt-24 pb-20 sm:pt-32 sm:pb-28"
    >
      <header className="mx-auto mb-12 grid max-w-6xl gap-4 px-5 sm:mb-16 sm:px-8">
        <p data-reveal="" className="tag text-stem">
          Exemplo
        </p>
        <SplitWords
          as="h2"
          id="exemplo-titulo"
          className="max-w-[18ch] font-display text-[2.5rem] leading-[1.05] sm:text-[3.5rem]"
          segments={[{ text: "Veja um site de verdade" }]}
        />
        <p data-reveal="" className="max-w-[46ch] text-[1.125rem] text-ink-soft">
          A Padaria do Zé é fictícia, mas o site foi feito pelo BrotaSites, com as mesmas sete
          perguntas que você vai responder.
        </p>
      </header>

      <div className="example-frame">
        <div
          role="img"
          aria-label="Início do site de exemplo da Padaria do Zé: o título “Pão quentinho todo dia”, o botão Fale conosco, o endereço, o horário de hoje e o telefone."
          className="example-window"
        >
          <div className="flex h-9 items-center justify-center border-b border-line bg-paper">
            <span className="tag truncate px-3 normal-case tracking-[0.02em] text-ink-soft">
              padaria-do-ze.brotasites.com
            </span>
          </div>
          <ExampleFrame src="/exemplo-site/index.html" />
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl px-5 sm:px-8">
        <Link
          href="/exemplo"
          className="touch-target group inline-flex items-center gap-2 text-[1.0625rem] font-semibold text-leaf-deep underline-offset-4 hover:underline"
        >
          Abrir o site de exemplo completo
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </section>
  );
}
