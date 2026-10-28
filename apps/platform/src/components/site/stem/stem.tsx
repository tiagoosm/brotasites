import { formSteps12 as formSteps } from "@brotasites/schema/v1.2";
import { stemNotes } from "@/content/stem";
import { excerpts } from "./excerpts";

// The home page's signature: the seven questions hang off one stem that grows as the
// visitor scrolls (a CSS scroll-driven animation in globals.css). When the tip of the ink
// reaches a question, its leaf unfurls and the question enters (motion-reveal.tsx). Fully
// grown without support, without JavaScript or with reduced motion.

function Leaf() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 24"
      className="stem-leaf absolute top-1.5 left-4 h-6 w-10 overflow-visible"
    >
      <path
        d="M0 12C9 1 26 0 38 9 26 18 10 20 0 12Z"
        fill="var(--leaf-wash)"
        stroke="var(--stem)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M2 12 33 9" stroke="var(--stem)" strokeWidth="1" opacity=".7" />
    </svg>
  );
}

export function Stem() {
  return (
    <ol
      className="stem relative grid gap-20 pl-14 sm:gap-24 sm:pl-20"
      aria-label="As sete perguntas"
    >
      <span aria-hidden="true" className="stem-track" />
      <span aria-hidden="true" className="stem-ink" />
      {formSteps.map((step, index) => {
        const Excerpt = excerpts[step.slug];
        return (
          <li
            key={step.slug}
            data-reveal="stem"
            className="stem-node relative grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-14"
          >
            <span className="stem-anchor absolute top-0 -left-14 sm:-left-20" aria-hidden="true">
              <Leaf />
            </span>
            <div className="grid gap-3">
              <p className="tag text-stem">
                Pergunta {index + 1} de {formSteps.length} · {step.title}
              </p>
              <h3 className="font-display text-[1.875rem] leading-[1.1] sm:text-[2.25rem]">
                {step.question}
              </h3>
              <p className="max-w-[44ch] text-[1.0625rem] text-ink-soft">{stemNotes[step.slug]}</p>
            </div>
            <Excerpt />
          </li>
        );
      })}
      <li data-reveal="stem" className="stem-node relative grid gap-2">
        <span className="stem-anchor absolute -top-1 -left-14 sm:-left-20" aria-hidden="true">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="stem-bud size-8 text-leaf">
            <path d="M12 13C12 8 8.5 5 3 5c0 5.5 3.5 8 9 8Z" fill="currentColor" />
            <path d="M12 11c0-4.5 3-7.5 9-7.5 0 5-3 7.5-9 7.5Z" fill="currentColor" opacity=".65" />
          </svg>
        </span>
        <p className="font-display text-[1.875rem] leading-tight sm:text-[2.25rem]">
          Pronto. Seu site no ar.
        </p>
      </li>
    </ol>
  );
}
