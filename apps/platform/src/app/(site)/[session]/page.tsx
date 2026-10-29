import type { Metadata } from "next";
import Link from "next/link";
import { CreateSiteButton } from "@/components/site/create-site-button";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { HeroRays } from "@/components/site/home/hero-rays";
import { PriceSection } from "@/components/site/home/price-section";
import { SplitWords } from "@/components/site/split-words";
import { Stem } from "@/components/site/stem/stem";
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

// Under the hero's buttons: the three things the page goes on to explain.
const heroFacts = [
  { title: "Sete perguntas", text: "Uma de cada vez, salvas na sua conta." },
  { title: "3 direções de visual", text: "Você escolhe a que tem a sua cara." },
  { title: "Você aprova", text: "Criar é grátis; paga só para publicar." },
];

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
        <section className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-6xl content-center px-5 pt-12 pb-20 sm:px-8 sm:pt-20 sm:pb-28 lg:min-h-[44rem]">
          <div className="hero-enter grid max-w-[52rem] gap-7 sm:gap-8">
            <h1 className="font-display text-[3.25rem] leading-[0.98] tracking-[-0.025em] sm:text-[5rem] lg:text-[6rem]">
              Sete perguntas <span className="block text-stem">e seu site pronto.</span>
            </h1>
            <p className="max-w-[38ch] text-[1.1875rem] text-ink-soft sm:text-[1.3125rem]">
              Conte o que você faz e escolha uma de 3 direções para o visual. A gente monta o site e
              você só aprova. Sem código.
            </p>
            <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
              <CreateSiteButton />
              <Link
                href="#como-funciona"
                className="touch-target text-[0.9375rem] text-ink-soft underline underline-offset-4 hover:text-ink"
              >
                Ver como funciona
              </Link>
            </div>
            <ul className="mt-4 grid max-w-[46rem] gap-x-10 gap-y-3 border-t border-line pt-6 text-[0.9375rem] text-ink-soft sm:grid-cols-3">
              {heroFacts.map((fact) => (
                <li key={fact.title} className="grid gap-0.5">
                  <span className="font-semibold text-ink">{fact.title}</span>
                  {fact.text}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

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
              andamento aparece no seu painel.
            </p>
          </header>
          <Stem />
          <div data-reveal="" className="mt-16 pl-14 sm:mt-20 sm:pl-20">
            <CreateSiteButton />
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
          <CreateSiteButton />
        </div>
      </section>
    </>
  );
}
