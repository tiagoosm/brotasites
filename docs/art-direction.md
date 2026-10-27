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

Locally hosted (woff2) open-license fonts, with the license checked in the official repository and recorded in `THIRD_PARTY_LICENSES.md`. Latin subset (Basic Latin and Latin-1, which cover every Portuguese accent).

Chosen in E3, all SIL OFL 1.1: Fraunces, Instrument Serif, DM Serif Display, Cormorant Garamond and Young Serif (serif titles); Bricolage Grotesque and Space Grotesk (sans titles); Fredoka and Baloo 2 (rounded titles); Manrope and DM Sans (text); Caveat and Kalam (handwritten labels). Playfair Display was a candidate but its name is a Reserved Font Name, and the OFL treats a subset as a modified version, so it was left out.

Font pairs (title + text + handwritten label) and the personalities each suits are in `packages/catalog/src/fonts.ts`. A title highlights a word in italics only when the title font has a real italic; otherwise it uses color or underline, since browsers fake a slanted italic.

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

## The catalog in code (E3)

`packages/catalog` holds the tokens; the engine (E4) picks among them and the templates (E5, E6) read them as CSS variables.

- **Grammar** (`grammar.ts`): per personality, the weighted lists of type scales, shapes, patterns, dividers, ornament sets, photo treatments, rhythms and mark styles the engine may draw from.
- **Palettes** (`palette.ts`): OKLCH recipes per personality, light and dark where they fit, with the hue from the brand color or the seed. Every palette is forced to AA: text 7:1 when reachable and never under 4.5:1, muted text and button text 4.5:1, buttons and ornaments 3:1 against the page. The "Fiel à marca" direction keeps the brand color exactly when it reaches 3:1 on the background.
- **Type scales** (`scale.ts`): 4 modular scales with fluid `clamp()` sizes from 360 to 1280 px, a large title-to-text jump and a display step for the giant name.
- **Shapes, patterns, rhythms, marks, motion**: radius sets; CSS-only patterns; section tone sequences (base, surface, inverse, brand, all pairs already AA); monogram styles with initials from the meaningful words of the name; the single motion preset of `default-motion.md`.
- **Dividers and ornaments** (`dividers.ts`, `ornaments.ts`): inline SVG built from geometry (seals, stars, sparkles, flowers, blobs, a hand-drawn arrow, waves, zigzags, drips, arches, thin grids, a dotted thread). Inline because the sites' CSP (`img-src 'self'`) blocks `data:` URIs. They carry no text: a fact such as "Desde 1998" is written over a seal by the template, only when the client gave it.
- **Photo treatments** (`treatments.ts`): offset frame, color block, polaroid, perforated stamp, tilt, duotone, grain, arch and circle masks, in plain CSS. The masks need a good photo.
- **Gradient backgrounds** (`backgrounds.ts`): seeded color spots with grain, every color checked against the text color. The grain is a small SVG file (`GRAIN_SVG`) the generator writes into each site.
- **Specimen**: `pnpm --filter @brotasites/catalog specimen` writes `packages/catalog/dist/specimen/index.html` with every font pair, palettes, ornaments, dividers and patterns.

Hero and section variants are not in the catalog yet: they arrive with the variant factory (E6).

## The identity engine (E4)

`packages/engine` turns the form answers into the 3 directions of a round, with no AI and no network.

- **Seed:** name, city, category and round, normalized (case, accents, spaces), so the same answers always give the same directions and a redo (round + 1) gives new ones.
- **Directions:**
  - "Fiel à marca" starts from the first feeling (or the family's default personality) and keeps the client's brand color as the primary when it reads on the page.
  - "Evolução" uses the second feeling and turns the hue 25 to 60 degrees.
  - "Contraste" takes the opposite personality, the opposite light mode when it has one, and a hue 120 to 240 degrees away.
- **Choices:** every token comes from the catalog grammar of the direction's personality, with its weights. Variants and photo treatments that need photos the client does not have are never offered. A client with a logo gets the "logo" mark; otherwise a monogram style.
- **Distance:** designs are compared on weighted features (personality, font pair, hero, scale, shape, ornaments, pattern, divider, photo treatment, rhythm, mark, light or dark, and the primary hue). 0 is the same design, 1 nothing in common. The 3 directions must be at least 0.45 apart, and each must be at least 0.3 from every site of the same family in the same city. A direction that misses is redrawn with a sub-seed (still deterministic), up to 24 times; if none reaches it, the best one is kept with a warning for the admin.
- **Fingerprint:** 16 hex characters from the features, stored in `design.identity.fingerprint`.
- **Uniqueness registry:** an interface with an in-memory version. The platform stores it in a Supabase table in E10. The approved direction is recorded at approval, before publishing, so drafts count.
- **Lock:** approving a direction copies its identity into the site and locks every identity field. Afterwards only overrides change the look: colors that keep AA (or are pulled to the nearest passing ones on request) and font pairs that suit the personality.
- **Provider:** `EngineProvider`, with `DeterministicEngine` as its implementation. The AI art director (E8) will sit behind `AiProvider` and fall back to the engine.

Until the variant factory (E6) ships real heroes and sections, the engine is tested with stand-in variants and 30 fictional businesses (10 each of food, beauty, events and creatives).

## The 1.2 template (E5)

`packages/templates/src/v12` renders 1.2 configs; 1.1 configs still render with "classico" until the platform moves to 1.2 (E10). `astro.config.ts` picks the page by `schemaVersion` (alias `@site-page`), so a site only ships its own CSS.

- **Tokens:** the identity (with the client's overrides) becomes `/assets/site.css`, with the font faces, color, type, radius and motion variables, the section tones, the pattern, the gradient and the photo treatment. Fonts are copied from the catalog into `/fonts/<id>/` with their `OFL.txt`; the grain is `/assets/grain.svg`. No Google Fonts and no network at build time.
- **CSP:** no inline `style` or `<style>`, no inline scripts other than the JSON-LD data block, no `data:` URIs. Stylesheets and scripts are files.
- **Base variants**, one per section, for every family and personality, listed in the catalog and mapped to components in `src/v12/variants/index.ts`: `hero-split`, `sobre-split`, `servicos-cards`, `como-funciona-steps`, `diferenciais-grid`, `galeria-mosaic`, `depoimentos-cards`, `faq-accordion`, `cta-final-band`, `contato-columns`. Without a photo the hero shows a seeded gradient with an ornament, plus a "Desde" seal only when the client gave the year. A gallery whose photos are missing is left out.
- **Photos** are `assets/<assetId>.<ext>` next to the config. They go through Astro's image pipeline at 480, 800, 1280 and 1920 px, in AVIF and WebP with a JPEG fallback.
- **Tested** in `e2e/v12.spec.ts` at 1280 and 360 px:
  - the page is served under the Worker's CSP;
  - no external request;
  - at most 8 KB of JS (gzip);
  - no sideways scroll at 360, 768 and 1280 px;
  - axe (WCAG A and AA);
  - content visible without JavaScript and at once with reduced motion;
  - 44 px touch targets;
  - "open now" and today's hours;
  - fonts with their licenses.

  Lighthouse on the fixture: mobile 98 performance and 100 accessibility and SEO; desktop 100 in every category.

## The variant factory (E6)

34 variants, listed in `packages/catalog/src/variants.ts` (what each suits and needs) and drawn by `packages/templates/src/v12/variants/` (HTML and CSS only, motion through `data-anim`):

| Section | Variants |
| --- | --- |
| hero | `hero-split` (every family), `hero-poster` (every family, no photo needed), `hero-feast` (food), `hero-fullbleed` (good photo only), `hero-arch` (beauty, events), `hero-bento` (food, events, retail), `hero-collage` (events, food) |
| sobre | `sobre-split`, `sobre-manifesto`, `sobre-card` |
| servicos | `servicos-cards`, `servicos-menu` (food, beauty), `servicos-list` |
| como-funciona | `como-funciona-steps`, `como-funciona-cards`, `como-funciona-path` |
| diferenciais | `diferenciais-grid`, `diferenciais-split`, `diferenciais-ribbon` |
| galeria | `galeria-mosaic`, `galeria-polaroids`, `galeria-grid` |
| depoimentos | `depoimentos-cards`, `depoimentos-quote`, `depoimentos-notes` |
| faq | `faq-accordion`, `faq-columns`, `faq-split` |
| cta-final | `cta-final-band`, `cta-final-poster`, `cta-final-stamp` |
| contato | `contato-columns`, `contato-card`, `contato-split` |

Heroes per family this round:
- food: 6 (`hero-feast`, `hero-split`, `hero-poster`, `hero-fullbleed`, `hero-bento`, `hero-collage`);
- beauty: 4 (`hero-split`, `hero-poster`, `hero-fullbleed`, `hero-arch`);
- events and creatives: 6 (`hero-split`, `hero-poster`, `hero-fullbleed`, `hero-arch`, `hero-bento`, `hero-collage`).

Rules every variant follows:
- **Weak photos:** a photo under 1200 px on its long side is "weak" (`isStrongPhoto`). Variants show it smaller (a framed print) instead of stretching it.
- **Missing photos:** every variant that can be offered without photos has an intentional no-photo state: gradient, ornaments, or a ribbon of the services' names. A gallery with no photos leaves the page.
- **Facts only from the form:** seals and blocks show only facts the client gave (founding year, city, services).
- **Readable text:** text never sits on a photo. Light-on-dark and dark-on-light sections use the palette pairs that are already AA.

How variants are checked:
- **Four states:** `node packages/templates/scripts/variant-states.mjs --out <dir> --hero <id> --sobre <id> ...` renders any variants in the four mandatory states (good photo, weak photo, no photo, long text) at 360 and 1280 px, with an `index.html` to compare them.
- **Matrix e2e:** `e2e/variants.spec.ts` builds a matrix of fixture sites that together use every variant, each with another personality and light mode, and checks every site at 360 and 1280 px: no sideways scroll, axe (WCAG A and AA, contrast included), no CSP violation, and 44 px touch targets.

Taste calibration: the food hero, "sobre" and "serviços" were rendered and sent to the owner before the rest was produced (see `docs/owner-steps.md`, "Decisions to review").
