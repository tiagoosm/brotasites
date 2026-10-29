import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { CREATE_HREF } from "@/components/site/nav";
import { ReadingPage, ReadingSection } from "@/components/site/reading-page";
import { CONTACT_EMAIL, PENDING } from "@/content/contact";
import { faqGroups } from "@/content/faq";

export const metadata: Metadata = {
  title: "Ajuda",
  description:
    "Respostas sobre como criar o seu site no BrotaSites: as sete perguntas, fotos, seus dados, preço e publicação.",
  alternates: { canonical: "/ajuda" },
};

// FAQPage structured data, so search results can show the answers.
const structuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqGroups.flatMap((group) =>
    group.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  ),
};

export default function HelpPage() {
  return (
    <ReadingPage
      eyebrow="Ajuda"
      title="Dúvidas sobre o BrotaSites"
      intro={
        <p>
          Respostas curtas sobre como funciona. Se preferir ver na prática,{" "}
          <Link
            href={CREATE_HREF}
            prefetch={false}
            className="font-semibold text-leaf-deep underline-offset-4 hover:underline"
          >
            comece a criar o seu site
          </Link>
          : é grátis.
        </p>
      }
      toc={[
        ...faqGroups.map((group) => ({ id: group.slug, label: group.title })),
        { id: "contato", label: "Não achou a resposta?" },
      ]}
    >
      <script
        type="application/ld+json"
        // Static content defined in this repository.
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD needs raw JSON
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {faqGroups.map((group) => (
        <ReadingSection key={group.slug} id={group.slug} title={group.title}>
          <FaqAccordion items={group.items} />
        </ReadingSection>
      ))}
      <ReadingSection id="contato" title="Não achou a resposta?">
        <p className="text-ink-soft">
          {CONTACT_EMAIL ? (
            <>
              Escreva para{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-leaf-deep underline-offset-4 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </>
          ) : (
            <>O canal de contato está {PENDING} e aparece aqui assim que estiver pronto.</>
          )}
        </p>
      </ReadingSection>
    </ReadingPage>
  );
}
