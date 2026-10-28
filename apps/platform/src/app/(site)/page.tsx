import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { ExampleShowcase } from "@/components/site/home/example-showcase";
import { HeroDemo } from "@/components/site/home/hero-demo";
import { HeroRays } from "@/components/site/home/hero-rays";
import { PriceSection } from "@/components/site/home/price-section";
import { SpecularLink } from "@/components/site/home/specular-link";
import { CREATE_HREF } from "@/components/site/nav";
import { SplitWords } from "@/components/site/split-words";
import { Stem } from "@/components/site/stem/stem";
import { Button } from "@/components/ui/button";
import { mainFaqs } from "@/content/faq";
import { PLATFORM_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: { absolute: "BrotaSites · Sete perguntas e seu site pronto" },
  description:
    "Responda sete perguntas, escolha uma de 3 direções para o visual e receba o site do seu negócio pronto. Com WhatsApp, horários e botão Como chegar. Sem código.",
  alternates: { canonical: "/" },
};

// Organization structured data for search engines.
const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "BrotaSites",
  url: PLATFORM_URL,
  slogan: "Sete perguntas e seu site pronto.",
  description: metadata.description,
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
      <Link href={CREATE_HREF} prefetch={false}>
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
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD needs raw JSON
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <div className="relative isolate overflow-hidden">
        <HeroRays />
        <section className="mx-auto grid max-w-6xl items-center gap-x-14 gap-y-24 px-5 pt-14 pb-28 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,30rem)] lg:pb-36">
          <div className="hero-enter grid gap-7">
            <h1 className="font-display text-[3.25rem] leading-[0.98] tracking-[-0.025em] sm:text-[4.5rem] lg:text-[4rem] xl:text-[4.5rem]">
              Sete perguntas <span className="block text-stem">e seu site pronto.</span>
            </h1>
            <p className="max-w-[34ch] text-[1.1875rem] text-ink-soft">
              Conte o que você faz e escolha uma de 3 direções para o visual. A gente monta o site e
              você só aprova. Sem código.
            </p>
            <div className="grid justify-items-start gap-5">
              <div className="flex flex-wrap items-center gap-3">
                <SpecularLink href={CREATE_HREF} prefetch={false}>
                  Criar meu site
                  <ArrowRight
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </SpecularLink>
              </div>
              <Link
                href="#como-funciona"
                className="touch-target text-[0.875rem] text-ink-soft underline underline-offset-4 hover:text-ink"
              >
                Ver como funciona
              </Link>
            </div>
          </div>
          <HeroDemo />
        </section>
      </div>

      <ExampleShowcase />

      <section
        id="como-funciona"
        aria-labelledby="como-funciona-titulo"
        className="scroll-mt-16 border-t border-line bg-card"
      >
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
          <header className="mb-16 grid gap-4 sm:mb-24">
            <p data-reveal="" className="tag text-stem">
              Como funciona
            </p>
            <SplitWords
              as="h2"
              id="como-funciona-titulo"
              className="max-w-[16ch] font-display text-[2.5rem] leading-[1.05] sm:text-[3.5rem]"
              segments={[{ text: "Sete perguntas, uma de cada vez." }]}
            />
            <p data-reveal="" className="max-w-[46ch] text-[1.125rem] text-ink-soft">
              Suas respostas ficam salvas na sua conta. Pode fechar a página e voltar depois: o
              andamento aparece em Meus sites.
            </p>
          </header>
          <Stem />
          <div data-reveal="" className="mt-16 pl-14 sm:mt-20 sm:pl-20">
            <CreateButton />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="recursos-titulo"
        className="mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20"
      >
        <header className="grid content-start gap-4">
          <SplitWords
            as="h2"
            id="recursos-titulo"
            className="font-display text-[2.25rem] leading-[1.08] sm:text-[2.75rem]"
            segments={[{ text: "O que todo site tem" }]}
          />
          <p data-reveal="" className="text-[1.0625rem] text-ink-soft">
            Você não precisa pedir nem configurar. Vem em todo site, em todos os modelos.
          </p>
        </header>
        <ul className="border-t border-line">
          {features.map((feature) => (
            <li
              key={feature.title}
              data-reveal=""
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

      <PriceSection />

      <section
        id="duvidas"
        aria-labelledby="duvidas-titulo"
        className="scroll-mt-16 mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20"
      >
        <header className="grid content-start gap-4">
          <SplitWords
            as="h2"
            id="duvidas-titulo"
            className="font-display text-[2.25rem] leading-[1.08] sm:text-[2.75rem]"
            segments={[{ text: "Dúvidas" }]}
          />
          <Link
            href="/ajuda"
            data-reveal=""
            className="touch-target text-[0.9375rem] font-semibold text-leaf-deep underline-offset-4 hover:underline"
          >
            Ver todas as dúvidas
          </Link>
        </header>
        <FaqAccordion items={mainFaqs} reveal />
      </section>

      <section aria-labelledby="final-titulo" className="border-t border-line bg-card">
        <div className="mx-auto grid max-w-3xl justify-items-center gap-7 px-5 py-28 text-center sm:px-8 sm:py-36">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-10 text-leaf">
            <path d="M12 22V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 13C12 8 8.5 5 3 5c0 5.5 3.5 8 9 8Z" fill="currentColor" />
            <path d="M12 11c0-4.5 3-7.5 9-7.5 0 5-3 7.5-9 7.5Z" fill="currentColor" opacity=".65" />
          </svg>
          <SplitWords
            as="h2"
            id="final-titulo"
            className="font-display text-[2.5rem] leading-[1.05] sm:text-[3.5rem]"
            segments={[{ text: "Seu site está a sete perguntas de distância." }]}
          />
          <p className="max-w-[40ch] text-[1.0625rem] text-ink-soft">
            Comece agora. Criar e ver o site pronto é grátis; você só paga para colocar no ar.
          </p>
          <CreateButton />
        </div>
      </section>
    </>
  );
}
