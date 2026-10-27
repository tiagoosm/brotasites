# Default motion (generated sites)

One choreography for every client site, written by us, with no animation library. React Bits and similar libraries do NOT go into the templates because of their license (MIT + Commons Clause): the client can download the site. The platform's own motion is described in `platform-design.md`.

## Principles

- CSS and IntersectionObserver. Content visible without JavaScript and before any animation.
- Only `transform` and `opacity` by default. `filter: blur` only on short titles (up to 12 words), up to 600 ms, off with reduced motion.
- Each element enters once. Shift up to 24 px. Durations: 150 to 250 ms for micro-interactions, 400 to 700 ms for entrances. Nothing over 900 ms.
- `prefers-reduced-motion`: content appears at once, with no delay.
- Splitting text by word happens at build time, with a single `aria-label` on the element and the parts `aria-hidden`.
- Urgency rule: contact details (WhatsApp, phone, address) never wait for an animation.
- No scroll hijacking, no Lenis, no GSAP. Scroll-driven animations (CSS scroll-driven) only as an enhancement under `@supports`.
- JS budget: 6 to 8 KB gzip in total. Lighthouse above 95.
- No layout shift (CLS) and no worse LCP.

## Attribute API

`data-anim="reveal"` (rises and appears), `"stagger"` (children in cascade, 60 to 90 ms apart), `"words"` (reveal by word), `"words-lit"` (words that light up with the scroll, for the manifesto), `"count"` (counter, only with a number the client gave), `"marquee"` (scrolling ribbon, pure CSS), `"expand"` (frame that grows to full width, without holding the scroll), `"float"` (gentle floating of an ornament). Delay through `data-anim-delay`. The numeric preset (durations, shifts, easings) comes from CSS variables; this round has a single preset. Variants cannot declare their own `@keyframes`, `transition` or JavaScript; the validator rejects them.

## Motion Lab

Internal route, outside the client site build, listing every behavior with a reduced-motion switch, for the owner to approve the motion.

## Implementation (E5)

In `packages/templates/src/v12/motion/`:

- `motion.css` holds every behavior. Elements wait hidden only under `@media (scripting: enabled) and (prefers-reduced-motion: no-preference)`. The script sets `data-motion-ready` on `<html>` as soon as it runs; if it never runs, a failsafe shows everything after 2.5 s. Elements enter when the script marks them `data-anim-in`.
- `motion.ts` (about 1 KB gzip with the opening-hours script) watches `[data-anim]` with one IntersectionObserver, marks each element once, and counts up `[data-anim="count"]` from 0 to the number already in the page. With reduced motion, or without IntersectionObserver, everything is marked at once.
- The sites' CSP forbids inline styles, so positions and delays are attributes, not `style`: `data-i` on split words (up to 30), `:nth-child` for stagger children (up to 13), `data-anim-delay` in steps of 100 ms (up to 400).
- Split text keeps a visually hidden full copy for screen readers; the word spans are `aria-hidden`.
- `words-lit` and `expand` use CSS scroll-driven animations under `@supports (animation-timeline: view())`; elsewhere the content is simply shown.

**Motion Lab:** `src/lab/MotionLab.astro`, added as `/motion-lab` only when `BROTASITES_LAB=1` and the config is 1.2, so it never ships with a client site:

```
BROTASITES_LAB=1 BROTASITES_CONFIG=$PWD/docs/site-config.example.json pnpm --filter @brotasites/templates dev
```

Then open http://localhost:4321/motion-lab. The "Reduzir movimento" button replays the page with motion off.
