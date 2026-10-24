import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { Specimen } from "@/components/site/home/specimen";
import { CREATE_HREF } from "@/components/site/nav";
import { Stem } from "@/components/site/stem/stem";
import { Button } from "@/components/ui/button";
import { mainFaqs } from "@/content/faq";

export const metadata: Metadata = {
  title: { absolute: "BrotaSites · Sete perguntas e seu site pronto" },
  description:
    "Responda sete perguntas e veja o site do seu negócio ficar pronto enquanto escreve. Com WhatsApp, mapa e horário de funcionamento. Sem código.",
  alternates: { canonical: "/" },
};

const features = [
  {
    title: "WhatsApp a um toque",
    text: "Um botão fixo leva o cliente direto para a conversa com você.",
  },
  {
    title: "Aberto ou fechado, na hora",
    text: "O site mostra se você está aberto agora, a partir do seu horário de funcionamento.",
  },
  {
    title: "Endereço e mapa",
    text: "Quem procura você encontra o caminho sem sair do site.",
  },
  {
    title: "Feito para o celular",
    text: "Abre rápido e fica bonito na tela onde seus clientes estão.",
  },
  {
    title: "Pronto para o Google",
    text: "Título, descrição e as informações do negócio já vêm configurados.",
  },
];

function CreateButton() {
  return (
    <Button asChild size="lg" className="group">
      <Link href={CREATE_HREF}>
        Criar meu site
        <ArrowRight
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </Link>
    </Button>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-x-14 gap-y-24 px-5 pt-14 pb-28 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,30rem)] lg:pb-36">
        <div className="hero-rise grid gap-7">
          <h1 className="font-display text-[3.25rem] leading-[0.98] tracking-[-0.025em] sm:text-[4.5rem] lg:text-[4rem] xl:text-[4.5rem]">
            Sete perguntas <span className="block text-stem">e seu site pronto.</span>
          </h1>
          <p className="max-w-[34ch] text-[1.1875rem] text-ink-soft">
            Conte o que você faz, escolha cores e fotos e veja o site tomar forma enquanto responde.
            Sem código.
          </p>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
            <CreateButton />
            <Link
              href="#como-funciona"
              className="text-[0.9375rem] font-semibold text-leaf-deep underline-offset-4 hover:underline"
            >
              Ver como funciona
            </Link>
          </div>
          <p className="tag text-ink-soft">Criar é grátis · Você só publica quando gostar</p>
        </div>
        <Specimen />
      </section>

      <section
        id="como-funciona"
        aria-labelledby="como-funciona-titulo"
        className="scroll-mt-16 border-t border-line bg-card"
      >
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
          <header className="mb-16 grid gap-4 sm:mb-24">
            <p className="tag text-stem">Como funciona</p>
            <h2
              id="como-funciona-titulo"
              className="max-w-[16ch] font-display text-[2.5rem] leading-[1.05] sm:text-[3.5rem]"
            >
              Sete perguntas, uma de cada vez.
            </h2>
            <p className="max-w-[46ch] text-[1.125rem] text-ink-soft">
              Cada resposta aparece na prévia na hora. Você pode voltar e mudar o que quiser antes
              de publicar.
            </p>
          </header>
          <Stem />
        </div>
      </section>

      <section
        aria-labelledby="recursos-titulo"
        className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20"
      >
        <header className="grid content-start gap-4">
          <h2
            id="recursos-titulo"
            className="font-display text-[2.25rem] leading-[1.08] sm:text-[2.75rem]"
          >
            O que todo site tem
          </h2>
          <p className="text-[1.0625rem] text-ink-soft">
            Você não precisa pedir nem configurar. Vem em todo site, em todos os modelos.
          </p>
        </header>
        <ul className="border-t border-line">
          {features.map((feature) => (
            <li
              key={feature.title}
              className="grid gap-1 border-b border-line py-6 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-8"
            >
              <h3 className="font-sans text-[1.0625rem] font-semibold tracking-normal">
                {feature.title}
              </h3>
              <p className="text-ink-soft">{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="gratis-titulo" className="bg-table">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-20 sm:px-8 md:grid-cols-[1fr_auto] md:gap-16">
          <div className="grid gap-3">
            <h2
              id="gratis-titulo"
              className="font-display text-[2.25rem] leading-[1.08] sm:text-[2.75rem]"
            >
              Criar é grátis.
            </h2>
            <p className="max-w-[48ch] text-[1.0625rem] text-ink-soft">
              Montar o site e ver a prévia não custa nada. O preço para publicar aparece antes de
              você publicar.
            </p>
          </div>
          <CreateButton />
        </div>
      </section>

      <section
        aria-labelledby="duvidas-titulo"
        className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20"
      >
        <header className="grid content-start gap-4">
          <h2
            id="duvidas-titulo"
            className="font-display text-[2.25rem] leading-[1.08] sm:text-[2.75rem]"
          >
            Dúvidas
          </h2>
          <Link
            href="/ajuda"
            className="text-[0.9375rem] font-semibold text-leaf-deep underline-offset-4 hover:underline"
          >
            Ver todas as dúvidas
          </Link>
        </header>
        <FaqAccordion items={mainFaqs} />
      </section>

      <section aria-labelledby="final-titulo" className="border-t border-line bg-card">
        <div className="mx-auto grid max-w-3xl justify-items-center gap-7 px-5 py-28 text-center sm:px-8 sm:py-36">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-10 text-leaf">
            <path d="M12 22V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 13C12 8 8.5 5 3 5c0 5.5 3.5 8 9 8Z" fill="currentColor" />
            <path d="M12 11c0-4.5 3-7.5 9-7.5 0 5-3 7.5-9 7.5Z" fill="currentColor" opacity=".65" />
          </svg>
          <h2
            id="final-titulo"
            className="font-display text-[2.5rem] leading-[1.05] sm:text-[3.5rem]"
          >
            Seu site está a sete perguntas de distância.
          </h2>
          <p className="max-w-[40ch] text-[1.0625rem] text-ink-soft">
            Comece agora e veja a prévia na hora. Você só publica quando gostar do resultado.
          </p>
          <CreateButton />
        </div>
      </section>
    </>
  );
}
