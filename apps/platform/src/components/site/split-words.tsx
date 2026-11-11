import { Fragment } from "react";

// A title revealed word by word. The server writes every word, so the title is complete
// and wraps the same without JavaScript. Screen readers get the whole title once, from
// aria-label; the word pieces are hidden from them. Two entrances:
// - "reveal" (h2, h3): once, when the title reaches the screen (motion-reveal.tsx);
// - "load" (the hero's h1, E31): CSS only, as the page paints, no wait for JavaScript. Each word
//   settles 0.32em up into place, opaque from the first frame (a fade, even from 0.6, delayed
//   the simulated phone's largest paint by about 0.4s), 750ms in all, once. Whole words, not
//   letters: each word keeps its kerning, so the title looks exactly as without the motion.
//   Static without JavaScript (`scripting: enabled`) and with reduced motion (globals.css).
// The split-text idea is designed after SplitText by React Bits (https://reactbits.dev, MIT +
// Commons Clause); our own code, CSS only.

/** The whole reveal lasts at most this long, however many words the title has. */
const SPREAD_MS = 200;
const MAX_STAGGER_MS = 60;
/** The hero's entrance on load: each word's rise, and the whole title (globals.css). */
const LOAD_WORD_MS = 460;
const LOAD_TOTAL_MS = 750;

interface Segment {
  text: string;
  className?: string;
}

interface SplitWordsProps {
  as: "h1" | "h2" | "h3";
  /** "reveal" on reaching the screen (default), or "load" as the page paints (the hero). */
  entrance?: "reveal" | "load";
  /**
   * Each letter in its own inline span, for the letters to lift near the mouse (the hero,
   * title-lift.tsx). Inline, not inline-block, so the letters keep their kerning.
   */
  letters?: boolean;
  /** The title, or its parts when part of it is styled apart (a second line, a color). */
  segments: Segment[];
  id?: string;
  className?: string;
}

export function SplitWords({
  as: Tag,
  segments,
  id,
  className,
  entrance = "reveal",
  letters = false,
}: SplitWordsProps) {
  const words = segments.flatMap((segment) => segment.text.split(/\s+/).filter(Boolean));
  const gaps = Math.max(1, words.length - 1);
  const stagger =
    words.length < 2
      ? 0
      : entrance === "load"
        ? (LOAD_TOTAL_MS - LOAD_WORD_MS) / gaps
        : Math.min(MAX_STAGGER_MS, SPREAD_MS / gaps);
  let index = 0;

  return (
    <Tag
      id={id}
      aria-label={segments.map((segment) => segment.text).join(" ")}
      data-reveal={entrance === "reveal" ? "words" : undefined}
      data-split={entrance === "load" ? "load" : undefined}
      className={className}
      style={{ "--word-stagger": `${Math.round(stagger)}ms` } as React.CSSProperties}
    >
      {segments.map((segment, s) => {
        // One element per word (a short title is hydrated with the page, so every node counts).
        const content = segment.text
          .split(/\s+/)
          .filter(Boolean)
          .map((word, w) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the words of a fixed title
            <Fragment key={w}>
              {(s > 0 || w > 0) && " "}
              <span
                aria-hidden="true"
                className="word"
                style={{ "--word-index": index++ } as React.CSSProperties}
              >
                {letters
                  ? [...word].map((letter, l) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the letters of a fixed word
                      <span key={l} className="char">
                        {letter}
                      </span>
                    ))
                  : word}
              </span>
            </Fragment>
          ));
        return segment.className ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a fixed title
          <span key={s} className={segment.className}>
            {content}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a fixed title
          <Fragment key={s}>{content}</Fragment>
        );
      })}
    </Tag>
  );
}
