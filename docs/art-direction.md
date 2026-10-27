# Art direction and catalog

Goal: beautiful, unique sites that do not look AI-made. The quality ceiling is the catalog, not the AI. The AI composes within it; the beauty comes from the designed pieces.

This document is about client sites. The platform's own look is in `platform-design.md`.

## Originality rule

The references listed below are protected third-party work. NEVER copy their layout, illustration, brand or text. Extract principles and create original variants. Do not use characters, logos or brands of third parties. No "engraving"-style line illustrations this round (owner's decision).

## Personalities (5)

| Personality | Tendencies | Principle references |
| --- | --- | --- |
| acolhedor | cream and warm tones, soft or rounded serif, rounded corners, organic shapes, gentle motion | Drizzle, Hairdo |
| elegante | restraint, uppercase and thin serif, asymmetry, dark or neutral, slow fade | Dragon Capital, Stay Route, Ember & Oak |
| moderno | geometric sans, strong type scale, thin lines, tilted cards, giant name | Chainly, Corebit, Senti, Agentix |
| robusto | high contrast, black with a warm accent, heavy serif, seals | Barber Elite |
| ousado | flat saturated colors, fat fonts, seals, ribbons, waves | Food Ora, Swirlzy, Unmapped, Epidemic Sound |

## Principles that become tokens

- **Title:** high-contrast serif, wide grotesque or fat rounded font; one highlighted word by color, italics or underline; a large scale jump between title and text.
- **Color:** a warm neutral base and one strong accent; OKLCH palettes generated from the seed with guaranteed AA contrast.
- **Section rhythm:** alternating light, dark and accent; A-B-A and A-B-C patterns; a gradual dark-to-light transition (gradient) to mark a change of subject.
- **Image:** frame with an offset outline, tilted polaroid, stamp with a perforated edge, full-width strip, color block offset behind the photo, cut-out over the text (only with a suitable photo), CSS treatments (duotone, grain, mask).
- **Original SVG ornaments:** toothed seals and stars, hand-drawn arrows with a note in a handwritten font, tilted scrolling ribbons (pure CSS), waves, zigzags, drips, arches and a grid of thin lines, the business name huge and cut off in the footer, organic shapes (flowers, circles), a dotted line stitching the sections together, a grid of colorful rounded icons, a seeded gradient background with grain.
- **Fact-based ornament:** a "Desde {ano}" seal, the neighborhood name or the number of locations only appear if the client gave the data.
- **Handwritten label** above titles (open handwritten font) as a human touch.
- **Text that lights up word by word** for the "Sobre" manifesto (up to 30 words).
- **Large step numbers** in "Como funciona" using `position: sticky`, without hijacking the scroll.
- **Icon grid** for "Diferenciais": line icons from our own set.

## Typography

Locally hosted (woff2) open-license fonts, with the license checked in the official repository and recorded in `THIRD_PARTY_LICENSES.md`. Candidates (licenses to confirm): Playfair Display, Fraunces, Instrument Serif, DM Serif Display, Cormorant Garamond, Young Serif, Bricolage Grotesque, Manrope, DM Sans, Space Grotesk, Fredoka, Baloo 2, Caveat, Kalam. Compatible font pairs defined in the catalog. Latin subset with the accents Portuguese needs.

## First families (this round): food, beauty, events and creatives

Styles to cover:

- Food: warm editorial (Drizzle's principle), playful and bold (Food Ora, Swirlzy), dark and sophisticated (Ember & Oak).
- Beauty: soft and warm (Hairdo), dark and sturdy (Barber Elite), restrained and elegant (Dragon Capital, Stay Route).
- Events and creatives: collage with stamps, polaroids and ribbons (Unmapped), tilted cards with handwritten notes (Chainly), flat color sections with italics (Epidemic Sound).

## Heroes (archetypes)

1. giant centered title + full-width photo strip
2. two columns with text and a framed photo
3. full-screen photo with a thin outlined title
4. typographic, over color or a gradient with grain (no photo)
5. grid of rounded blocks (bento)
6. giant title with a cut-out passing in front (requires a cut-out photo)
7. asymmetric, title anchored at the bottom left

Each variant declares `requires.photo: none | optional | required`. The system only offers variants whose requirement the client meets. A client without photos gets only the variants that need none, and those must be as good as the rest.

## Four mandatory states per variant

Every variant is tested with: good photo, weak photo (low resolution, badly framed), no photo, and long text (80-character name, 9 services, description at the limit). If any state looks bad or breaks, the variant does not enter the catalog.

## Tests for every variant

AA contrast, no sideways scroll at 360, 768 and 1280 px, no external request, weight within budget, `prefers-reduced-motion`, content visible without JavaScript, 44 px touch targets, no motion of its own (only `data-anim` attributes).

## References used (principles)

Food: Drizzle, Food Ora, Swirlzy, Ember & Oak. Beauty: Hairdo, Barber Elite, Dragon Capital, Stay Route. Events and creatives: Unmapped, Chainly, Epidemic Sound. Structure and finish: Ranty (floating card with differentiators), Corebit (growing frame, giant blurred name in the background), Agentix (large numbers, word in italics, counters), Senti (grid lines and arches), Solar Foods (blurred gradient), Uni (gradient with grain, handwritten labels, icon grid, FAQ accordion), Five Pathways (dotted line stitching the sections), Squarespace (dark-to-light transition), Rulebase (text lighting up by word, texture), Glide (grid of colored icons), Celestia Smiles (expandable cards; no 3D, no "before and after").

## What is left out

Review cards with stars, metrics ("12m+", "98%"), third-party logos, award and compliance seals as decoration, video backgrounds, 3D, WebGL, carousels pinned to the scroll, calculators, booking widgets, app mockups, protected characters, text over a photo without a computed darkening.

## Targets this round

Per family: 4 heroes. Shared sections: 3 variants each (sobre, servicos, como-funciona, diferenciais, galeria, depoimentos, faq, cta-final, contato). Before mass production, a taste calibration with the owner (see E6 in `PLAN.md`).
