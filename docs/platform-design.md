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

- Stem drawing (stroke-dashoffset, 900ms ease-in-out) and leaf unfurling (700ms ease-out).
- Question content rises in with a short stagger when the step changes.
- The live marker pings slowly; the bud breathes.
- Buttons press to 0.97. No other decoration.
- Everything is disabled under `prefers-reduced-motion`.

## Layout

- Desktop (≥1280px): questions rail | form column | live preview on the table.
- 1024 to 1279px: form | preview; the stem moves to the header.
- Phones: form only, header with the horizontal stem, a sticky footer with "Ver prévia" and the next button; the preview opens full screen.
