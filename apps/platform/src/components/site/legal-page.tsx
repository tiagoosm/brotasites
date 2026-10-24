import { LEGAL_NOTICE, LEGAL_UPDATED, type LegalSection } from "@/content/legal";
import { ReadingPage, ReadingSection } from "./reading-page";

/** Terms and privacy: numbered sections, the last-updated date and the review notice. */
export function LegalPage({
  eyebrow,
  title,
  sections,
}: {
  eyebrow: string;
  title: string;
  sections: LegalSection[];
}) {
  return (
    <ReadingPage
      eyebrow={eyebrow}
      title={title}
      intro={
        <div className="grid gap-4">
          <p>Atualizado em {LEGAL_UPDATED}.</p>
          <p
            role="note"
            className="rounded-lg border border-pollen/60 bg-pollen/10 px-4 py-3 text-[0.9375rem] text-ink"
          >
            {LEGAL_NOTICE}
          </p>
        </div>
      }
      toc={sections.map((section, index) => ({
        id: section.id,
        label: `${index + 1}. ${section.title}`,
      }))}
    >
      {sections.map((section, index) => (
        <ReadingSection key={section.id} id={section.id} title={`${index + 1}. ${section.title}`}>
          {section.blocks.map((block) =>
            typeof block === "string" ? (
              <p key={block} className="text-[1.0625rem] leading-relaxed text-ink-soft">
                {block}
              </p>
            ) : (
              <ul
                key={block.list[0]}
                className="grid list-disc gap-2 pl-5 text-[1.0625rem] leading-relaxed text-ink-soft marker:text-stem"
              >
                {block.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          )}
        </ReadingSection>
      ))}
    </ReadingPage>
  );
}
