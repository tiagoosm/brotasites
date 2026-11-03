# Design references: Refero Styles review

Reviewed on 2026-11-03 at https://styles.refero.design/. It is a beta library of website style guides, each with colors, type, spacing and components. The page claims 2,000+ entries; 20 were visible at review time.

## How this document is used

- **Originality:** the same rule as `art-direction.md` ("Originality rule") applies. These are third-party works:
  - only principles are recorded here, in our own words;
  - never copy a layout, text, illustration, brand, logo or exact value;
  - no third-party style guide file is stored in this repository.
- **License:** the library's license and terms of use were not visible on the pages reviewed. Treat every entry as protected until the owner checks the terms ("to verify"). This applies before any wider use of the library, for example through its MCP connector.
- **Fit:** almost all entries are software and finance product sites. Our clients are bakeries, salons, caterers, photographers and similar local businesses, with real photos, WhatsApp as the main action and a mobile audience. Principles are taken only where they transfer; the many that depend on product screenshots, dashboards or 3D hardware are left out.

## Kept (8 of the 20 reviewed)

Each line gives the principle and the personality it feeds.

| Reference | Principle taken | Feeds |
| --- | --- | --- |
| Notion | A warm off-white canvas with pure white cards on top; hierarchy through one near-black at several opacities; very heavy, tightly tracked display type that relaxes at body sizes; a serif only for editorial moments; hairline low-contrast borders instead of shadows; a pill highlight around one key word in a title; small hand-drawn style marks for friendliness | acolhedor |
| Perplexity AI | A paper-warm base with no pure black or white; a single deep accent used for state (active, selected, a faint glow around the main control); only two type weights; flat surfaces separated by color and spacing rather than elevation | acolhedor |
| ElevenLabs | A warm "eggshell" base with a deeper warm band for sections and cards; light-weight display titles with tight tracking; black pill primary button, light pill secondary; the accent colors live only inside illustrations, never in controls; soft gradient shapes as the one big visual | acolhedor, elegante |
| Intercom | Section changes made by shifting the background tone instead of drawing divider lines; one single small corner radius everywhere; a light-weight sans at large sizes for a quiet voice; small widely tracked uppercase labels; a light serif for some paragraphs; at most two type voices per screen | elegante |
| Steep | A regular-weight serif for large titles with half-step weights in the sans for hierarchy (no jump to bold); one warm peach callout allowed per page as the only color; hairlines do the separating; generous gaps between sections | elegante |
| monopo saigon | Quiet type (light weight, very tight leading at large sizes); square cards and images with fully rounded buttons only; full-width unframed project photos; one large soft color field behind the hero; slow, deliberate motion with a gentle ease-out; a slowly rotating circular text badge as the one ornament | elegante, moderno |
| teenage engineering | A catalogue rhythm: a strict grid, regular spacing, photos running edge to edge in their cell so the photo is the card; square corners; flat light and dark bands for depth; faint, small type that lets the objects lead | moderno |
| Wise | A deep green with one bright, rarely used accent; a very heavy display face for headlines against a clean sans for everything else; fully rounded buttons and tags; dark inverted cards on a light page; green- or warm-tinted neutrals instead of pure gray | robusto, ousado |

## Discarded (12 of the 20)

| Reference | Why |
| --- | --- |
| Apple iPhone Duo, Apple iPhone 18 Pro | Hardware showcase built on product renders and a dark gallery; no equivalent for a local business |
| Brex, Ramp, Origin Financial | Finance product sites: cold, data-driven, trust through compliance cues (which `art-direction.md` excludes as decoration) |
| Reflect Notes, ORYZO AI, Dala | Dark, "cosmos" and AI-product aesthetics; they point toward the look we are trying not to have |
| Figma, Vercel, Ui | Tool sites that depend on product screenshots or code motifs |
| OpenAI | A research-notebook look that depends on long editorial text |

## Principles worth turning into catalog ideas (candidates, not decisions)

These are proposals for the next catalog round. None is built. Each must pass:

- the taste calibration with the owner (E6);
- the variant tests: AA contrast, 360/768/1280 px, 44 px targets, reduced motion, no JavaScript of its own.

The candidates:

1. **Tone-shift rhythm without lines.** Section changes are marked only by a background tone step (cream, deeper cream, white card), plus hairlines, with no shadows. The catalog already has tone sequences; this would add a "paper" sequence for the acolhedor and elegante personalities.
2. **Single-radius shape set.** One small radius for everything (cards, inputs, images), with fully rounded buttons and tags. Today's shape sets could gain this as a named option.
3. **Square-and-pill shape set.** Square cards and photos, pill buttons only (the monopo and teenage engineering pattern).
4. **Edge-to-edge photo card.** The photo fills its grid cell with no padding or frame, and the caption sits below. It works for food, beauty and creatives with good photos. It needs a fallback for weak or missing photos (the four states of the variant tests).
5. **One-color-per-page rule.** A warm neutral page with a single accent (or a single "callout" block), used rarely; the accent appears in controls only for state.
6. **Pill highlight on one title word.** Already close to the "one highlighted word" principle in `art-direction.md`; this would add the pill-behind-the-word form.
7. **Type voices.** At most two voices per screen: a light or regular display face, half-step weights in the sans, and small tracked uppercase labels.
8. **Slower ease-out for elegante.**
   - About 0.7 to 0.9 s, within the 900 ms limit of `default-motion.md` (owner's decision of 2026-11-03: never above it).
   - `default-motion.md` has a single choreography and a single preset this round, so this would become a per-personality duration scale inside that limit, not a new choreography.
9. **Rotating text badge.**
   - One slow circular text badge as an ornament.
   - It uses a fact the client gave (for example the neighborhood or "Desde {ano}"), never an invented one.
   - It would need a new `data-anim` behavior, since variants cannot declare their own motion (`default-motion.md`).

## What not to take

- **No photos:** most of these references have almost no photos. Our sites live on the client's photos and need good states for weak or missing ones.
- **AI aesthetics:** dark "AI" gradients, constellations, glows and 3D are excluded by `art-direction.md` (no 3D, no WebGL on client sites).
- **Light type at small sizes:** very light weights fail AA and readability on phones. Any light display face is limited to large sizes and checked for contrast.
- **Tiny text and faint separators:** thin 13 px body text, tiny captions and low-contrast hairlines as the only separator conflict with the 44 px touch targets and AA rules.
- **Screenshot-dependent patterns:** anything that depends on a product screenshot, a code block or a dashboard.
- **Long animations:** anything slower than the 900 ms limit of `default-motion.md`.

## Next steps (owner)

- Check the library's terms before using more than principles (and before connecting its MCP).
- Send more references of local-business sites (bakeries, salons, photographers, caterers). They will map better than software sites to the families we ship first.
