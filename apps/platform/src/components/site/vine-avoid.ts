import { outermost, type Rect } from "@/lib/motion/vine";

// The content the mouse vine must stay off (vine-trail.tsx, lib/motion/vine.ts): measured once
// the page is idle and again when the layout changes (size, fonts, content), never on a mouse
// move. Page boxes are kept in page coordinates; the sticky header stays where it is.

const CONTENT =
  "main h1, main h2, main h3, main h4, main p, main li, main label, main a, main button, main input, main textarea, main select, main img, main details, main [data-card], main .glow-card, main [role='region'], footer";

export interface Avoid {
  page: Rect[];
  fixed: Rect[];
}

export function watchContent(onChange: (avoid: Avoid) => void): () => void {
  let task = 0;
  const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 120));
  const cancel = window.cancelIdleCallback ?? window.clearTimeout;

  const measure = () => {
    task = 0;
    const scroll = window.scrollY;
    const boxes: Rect[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(CONTENT)) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      boxes.push([box.left, box.top + scroll, box.right, box.bottom + scroll]);
    }
    const header = document.querySelector("body > header, header")?.getBoundingClientRect();
    onChange({
      page: outermost(boxes).sort((a, b) => a[1] - b[1]),
      fixed: header ? [[0, 0, window.innerWidth, header.bottom]] : [],
    });
  };
  const schedule = () => {
    if (!task) task = idle(measure, { timeout: 500 }) as number;
  };

  const sized = new ResizeObserver(schedule);
  sized.observe(document.body);
  window.addEventListener("resize", schedule);
  document.fonts?.ready.then(schedule).catch(() => {});
  schedule();
  return () => {
    if (task) cancel(task);
    sized.disconnect();
    window.removeEventListener("resize", schedule);
  };
}
