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
                <WithEmailLinks text={block} />
              </p>
            ) : (
              <ul
                key={block.list[0]}
                className="grid list-disc gap-2 pl-5 text-[1.0625rem] leading-relaxed text-ink-soft marker:text-stem"
              >
                {block.list.map((item) => (
                  <li key={item}>
                    <WithEmailLinks text={item} />
                  </li>
                ))}
              </ul>
            ),
          )}
        </ReadingSection>
      ))}
    </ReadingPage>
  );
}

const EMAIL = /([a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi;

/** The contact addresses in the legal text, as mailto links (E28). */
function WithEmailLinks({ text }: { text: string }) {
  const parts = text.split(EMAIL);
  if (parts.length === 1) return text;
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <a
        // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed sentence
        key={index}
        href={`mailto:${part}`}
        className="touch-target font-medium text-leaf-deep underline decoration-1 underline-offset-[3px] hover:decoration-2"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}
