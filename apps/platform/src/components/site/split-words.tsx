// A title revealed word by word. The server writes every word, so the title is complete
// and wraps the same without JavaScript. Screen readers get the whole title once, from
// aria-label; the word pieces are hidden from them. The title enters once, when it reaches
// the screen (motion-reveal.tsx). The hero title is not split: animating it on load delayed
// the largest paint by about 0.4s on a simulated phone.

/** The whole reveal lasts at most this long, however many words the title has. */
const SPREAD_MS = 200;
const MAX_STAGGER_MS = 60;

interface Segment {
  text: string;
  className?: string;
}

interface SplitWordsProps {
  as: "h2" | "h3";
  /** The title, or its parts when part of it is styled apart (a second line, a color). */
  segments: Segment[];
  id?: string;
  className?: string;
}

export function SplitWords({ as: Tag, segments, id, className }: SplitWordsProps) {
  const words = segments.flatMap((segment) => segment.text.split(/\s+/).filter(Boolean));
  const stagger = words.length > 1 ? Math.min(MAX_STAGGER_MS, SPREAD_MS / (words.length - 1)) : 0;
  let index = 0;

  return (
    <Tag
      id={id}
      aria-label={segments.map((segment) => segment.text).join(" ")}
      data-reveal="words"
      className={className}
      style={{ "--word-stagger": `${Math.round(stagger)}ms` } as React.CSSProperties}
    >
      {segments.map((segment, s) => {
        const pieces = segment.text.split(/\s+/).filter(Boolean);
        const content = pieces.map((word, w) => {
          const style = { "--word-index": index++ } as React.CSSProperties;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: the words of a fixed title
            <span key={w}>
              {w > 0 && " "}
              <span aria-hidden="true" className="word" style={style}>
                {word}
              </span>
            </span>
          );
        });
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a fixed title
          <span key={s} className={segment.className}>
            {s > 0 && " "}
            {content}
          </span>
        );
      })}
    </Tag>
  );
}
