# Platform design: Herbarium

Art direction for the BrotaSites platform (form, dashboard and marketing pages). Chosen on 2026-10-20 out of three directions (Herbarium, Storefront sign, Azulejo). Client sites keep their own templates; this document covers only the platform around them. Copy rules live in [platform-copy.md](platform-copy.md).

## Idea

The name is BrotaSites: the client's site *sprouts*. The platform is a botanical plate (herbarium sheet): cool paper, ink-green line work, specimen-tag labels. It stays quiet so the client's site in the preview is the star.

## Tokens

| Token | Hex | Use |
| --- | --- | --- |
| Paper | `#F7F8F3` | Page background, rail |
| Table | `#ECEEE7` | Surface the live preview sits on |
| Surface | `#FFFFFF` | Form column, inputs |
| Ink | `#14241B` | Text |
| Ink soft | `#4D5C53` | Secondary text |
| Line / line strong | `#D7DDD2` / `#C3CCBF` | Hairlines, input borders, stem guide |
| Leaf | `#2F7A4A` | Primary actions, selected states, focus ring |
| Leaf deep | `#22603A` | Hover, text on leaf wash |
| Leaf wash | `#E2EFE4` | Selected tag background, leaves |
| Stem | `#2F5D45` | Botanical line work, step tags |
| Pollen | `#E2B23C` | Only for "now": the current question and the live preview marker |

Defined as CSS variables in `apps/platform/src/app/globals.css` and mapped to shadcn/ui tokens. There is no dark theme yet; shadcn `dark:` styles only apply under an explicit `.dark` class.

## Type

- **Young Serif** (400): question titles and display headings. Used with restraint.
- **Hanken Grotesk**: body, labels and controls.
- **IBM Plex Mono** (500, uppercase, tracked): the `.tag` class for machine-like values (question numbers, addresses, color codes).

Loaded with `next/font`.

## Shapes

- Buttons: full pill. Primary is leaf with a subtle inner highlight and a tinted shadow; press scales to 0.97.
- Inputs: 12px radius, white, 52px tall, leaf border and a 4px leaf/15 ring on focus.
- Choice lists (e.g. business type): pill tags backed by native radio inputs.

## Signature

The **stem** in the questions rail (`sprout-progress.tsx`): a dashed pencil guide with an ink stem drawn up to the current question. Every answered question opens a leaf, and the current one carries a pollen bud. On phones it becomes a horizontal stem under the header. This is the one memorable element; everything else stays plain.

## Motion

One motion language, defined as tokens in `globals.css` and used everywhere:

| Token | Value | Use |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Main curve: entrances, answers to a touch |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Secondary curve: things that travel |
| `--motion-micro` | 180ms | Micro-interactions (150 to 250ms) |
| `--motion-enter` | 560ms | Section entrances (400 to 700ms) |
| `--motion-unfurl` | 720ms | A leaf unfurling on the stem |
| `--motion-word` | 400ms | Each word of a title revealed word by word |
| `--motion-stagger` | 70ms | Between items entering together |
| `--motion-shift` / `--motion-blur` | 16px / 3px | How far an entrance travels, and its blur |

Nothing runs over 900ms, except what follows the scroll.

- Section entrances (home page): each element marked `data-reveal` rises 16px with a short fade and blur as it reaches the screen, and again every time it comes back, scrolling down or up (E18, `motion-reveal.tsx`, rules in `lib/motion/reveal.ts`). It waits again only once it is fully off screen by 160px, so nothing blinks while visible. At most 8 entrances run at once; beyond that, during a jump to a section, or for what a fast scroll passed, elements are shown in their final state at once. The HTML always holds the final content: without JavaScript or with reduced motion nothing is hidden.
- Section titles (h2 on the home page): revealed word by word as they reach the screen, each time, in at most 600ms in all (`split-words.tsx`). The server writes the whole title, the heading carries it in `aria-label` and the word pieces are `aria-hidden`.
- Hero: the title stays still (animating it delayed the largest paint by about 0.4s on a simulated phone); the text and the buttons under it rise in once on load.
- Home page stem (E18): one curved stroke snaking gently through the questions (`lib/motion/stem.ts`, measured by `stem-geometry.tsx` with a ResizeObserver), tapering from 4.2px at the base (top) to 1.4px at the young tip, dark stem green to leaf green. A mask line drawn with the scroll (stroke-dashoffset on a normalized path, CSS scroll-driven animation) reveals it. When the tip reaches a question its leaf buds from the stem, grows and opens with a slight turn and a small sway (1.1s); small leaflets and a curl of tendril grow between questions; four hand-drawn leaf shapes, alternating sides, sizes and angles. The last question blooms (five petals, a soft pollen glow). Young leaves keep a slow 2.5° sway on screen. Whole and open without support, without JavaScript or with reduced motion.
- Form stem: drawing (stroke-dashoffset, 900ms ease-in-out) and leaf unfurling (700ms ease-out).
- Question content rises in with a short stagger when the step changes.
- The live marker pings slowly; the bud breathes.
- One header on every page (E17), sticky, 64px: the brand, the four links centered, and the account on the right (a 44px round profile button with the initials). The profile menu drops 4px in 140ms (nothing for reduced motion). Phone menu: the sheet fades in and its items rise in one after the other, the main button last (about 0.65s in all). It is rendered in the body, outside the header, whose backdrop blur would otherwise squeeze the fixed sheet into the header's height. On the form, the progress sits right under the header (the stem rail from 1280px).
- Buttons press to 0.97. Every "Criar meu site" / "Criar site" button (hero, after the questions, closing call, header, phone menu, the dashboard's first site) has the specular finish (E18, `create-site-button.tsx`): a cream light on its rim that follows the mouse, quieter on the header's smaller button (still, on the top-left, on touch screens and with reduced motion). The light is its own layer moved only with transform, eased once per frame toward the cursor; the button's box is read on enter, scroll and resize, never on a move. Inside, the sheen stays at 4% so the white text keeps at least 4.5:1.
- Price card glow (E18): the lit arc turns round the border once every 12s at rest (a CSS animation of `rotate` on its own layer); the mouse takes over, easing the short way round to the cursor, and the turn resumes from where it stopped. Touch screens keep the turn; reduced motion keeps a still glow. Paused off screen and in a hidden tab.
- Section links (E18, `anchor-scroll.tsx`): Como funciona, Preço and Dúvidas scroll there in 600 to 900ms (longer for longer distances) with an ease-in-out curve, stop under the header, focus the section title and put the "#" in the address; from another page the home page opens and then scrolls. A wheel, touch or key stops it; reduced motion jumps.
- Mouse vine (E18): over the whole public page with a mouse, only in the free space; it fades out within 10px of text, links, buttons, cards, fields, images, the questions' window, the header and the footer (the content's boxes are measured when the layout changes and clipped in the WebGL shader). Off on touch screens and with reduced motion.
- Everything is disabled under `prefers-reduced-motion`.

## Layout

- Desktop (≥1280px): questions rail | form column | live preview on the table.
- 1024 to 1279px: form | preview; the stem moves to the header.
- Phones: form only, header with the horizontal stem, a sticky footer with "Ver prévia" and the next button; the preview opens full screen.
