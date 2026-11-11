# Platform design: Herbarium

Art direction for the BrotaSites platform (form, dashboard and marketing pages). Chosen on 2026-10-20 out of three directions (Herbarium, Storefront sign, Azulejo). Client sites keep their own templates; this document covers only the platform around them. Copy rules live in [platform-copy.md](platform-copy.md).

## Idea

The name is BrotaSites: the client's site *sprouts*. The platform is a botanical plate (herbarium sheet): cool paper, ink-green line work, specimen-tag labels. It stays quiet so the client's site (the 3 directions and the finished site) is the star.

## Tokens

| Token | Hex | Use |
| --- | --- | --- |
| Paper | `#F7F8F3` | Page background, rail |
| Table | `#ECEEE7` | Surface the form's card and the price section sit on |
| Surface | `#FFFFFF` | Form column, inputs |
| Ink | `#14241B` | Text |
| Ink soft | `#4D5C53` | Secondary text |
| Line / line strong | `#D7DDD2` / `#C3CCBF` | Hairlines, input borders, stem guide |
| Leaf | `#2F7A4A` | Primary actions, selected states, focus ring |
| Leaf deep | `#22603A` | Hover, text on leaf wash |
| Leaf wash | `#E2EFE4` | Selected tag background, leaves |
| Stem | `#2F5D45` | Botanical line work, step tags |
| Pollen | `#E2B23C` | Only for "now" and "your turn": the current question, the client's pending items |

Defined as CSS variables in `apps/platform/src/app/globals.css` and mapped to shadcn/ui tokens. There is no dark theme yet; shadcn `dark:` styles only apply under an explicit `.dark` class.

## Type

- **Young Serif** (400): question titles and display headings. Used with restraint.
- **Hanken Grotesk**: body, labels and controls.
- **IBM Plex Mono** (500, uppercase, tracked): the `.tag` class for machine-like values (question numbers, addresses, color codes).

Loaded with `next/font`.

## Shapes

- Buttons: full pill. Primary is leaf with a subtle inner highlight and a tinted shadow; press scales to 0.97.
- Inputs: 12px radius, white, 52px tall, leaf border and a 4px leaf/15 ring on focus.
- Loading (E26, Doherty): a 3px leaf bar at the top for every internal navigation (`navigation-progress.tsx`), started by the click itself (or announced by the code before a `router.push`), shown after 80ms so quick ones never flash, still with reduced motion. The link being followed turns `aria-busy` (progress cursor) with a small pulsing dot or, on a button, a nudging arrow (`link-pending.tsx`). Account pages are not prefetched from the public pages but warm up by intent (pointer, focus, touch; opening the profile menu). Each account segment has a `loading.tsx`: a skeleton of the same frame and size as the page (`components/ui/skeleton.tsx`, `components/loading/skeletons.tsx`), table-grey blocks with a very soft sheen (none with reduced motion), `role="status"` with "Carregando…" said once and `aria-busy`, revealed only after about 120ms; never text that looks like content. The shared layout never waits: the header's shell and the footer stream at once, and only the account side of the header waits for the session behind a placeholder of a fixed width (the header's right side is 12rem/14rem wide from 768px in every state, so the middle links never move). Signing in keeps "Entrando…" until the next page is on screen. This covers only the moment between a click and the page: there is still no loading screen for generating a site.
- Cursors (E26, one set of rules in `globals.css`, `@layer base`): the hand on whatever acts on a click (links, buttons, menu items, tabs, switches, checkboxes, radios, `summary`, `label[for]`, selects, file pickers, whole clickable cards via `data-clickable`); the text bar on text fields; `not-allowed` on anything blocked (`:disabled`, `aria-disabled`, `data-disabled`, labels of disabled inputs), always with the reason in text next to it (never only a tooltip); `progress` on what is working (`aria-busy`, e.g. "Entrando…", "Criando…"). Disabled controls keep their pointer events (no `pointer-events-none`), so the blocked cursor shows; only icons and decorative layers (the light, the vine, canvases) ignore the pointer. `e2e/cursors.spec.ts` fails on any interactive element left with the default arrow.
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
| `--motion-shift` / `--motion-blur` | 16px / 2px | How far an entrance travels; the blur of a title's words (titles only) |

Nothing runs over 900ms, except what follows the scroll.

- Section entrances (home page): each element marked `data-reveal` rises 16px with a short fade as it reaches the screen, and again every time it comes back, scrolling down or up (E18, `motion-reveal.tsx`, rules in `lib/motion/reveal.ts`). It waits again only once it is fully off screen by 160px, so nothing blinks while visible. At most 8 entrances run at once; beyond that, during a jump to a section, or for what a fast scroll passed, elements are shown in their final state at once. The HTML always holds the final content: without JavaScript or with reduced motion nothing is hidden.
- Section titles (h2 on the home page): revealed word by word as they reach the screen, each time, in at most 600ms in all (`split-words.tsx`). The server writes the whole title, the heading carries it in `aria-label` and the word pieces are `aria-hidden`.
- Blur rule (E31): `filter: blur` only on the words of short titles (split words), never on a block, a card or a paragraph. A blurred card stays resampled while it is already readable (the price card was, for about 0.35s), which reads as a defect. `e2e/glow-card.spec.ts` checks every frame of the price card's entrance.
- Hero (E31): the title settles in word by word on load, in CSS only (`split-words.tsx`, entrance "load"): each word rises 0.32em into place, 750ms in all, once, opaque from the first frame (a fade delayed the largest paint on a simulated phone; the rise does not). Whole words keep the kerning and the line breaks of the plain title at every size. Still without JavaScript (`@media (scripting: enabled)`) and with reduced motion. The text and the buttons under it rise in once on load. With a mouse, the title's letters lift toward the cursor (`title-lift.tsx`, owner's reference): the nearest about 0.14em, the neighbours less within about 0.6em, settling back when it leaves; each letter is an inline span moved with `top`, so the kerning stays; nothing on touch screens or with reduced motion.
- Home page stem (E18): one curved stroke snaking gently through the questions (`lib/motion/stem.ts`, measured by `stem-geometry.tsx` with a ResizeObserver), tapering from 4.2px at the base (top) to 1.4px at the young tip, dark stem green to leaf green. A mask line drawn with the scroll (stroke-dashoffset on a normalized path, CSS scroll-driven animation) reveals it. When the tip reaches a question its leaf buds from the stem, grows and opens with a slight turn and a small sway (1.1s); small leaflets and a curl of tendril grow between questions; four hand-drawn leaf shapes, alternating sides, sizes and angles. The last question blooms (five petals, a soft pollen glow). Young leaves keep a slow 2.5° sway on screen. Whole and open without support, without JavaScript or with reduced motion.
- Form stem: drawing (stroke-dashoffset, 900ms ease-in-out) and leaf unfurling (700ms ease-out).
- Question content rises in with a short stagger when the step changes.
- The dashboard's "working" dot pings slowly; the bud breathes.
- One header on every page (E17), sticky, 64px: the brand, the four links centered, and the account on the right (a 44px round profile button with the initials). The profile menu drops 4px in 140ms (nothing for reduced motion). Phone menu: the sheet fades in and its items rise in one after the other, the main button last (about 0.65s in all). It is rendered in the body, outside the header, whose backdrop blur would otherwise squeeze the fixed sheet into the header's height. On the form, the progress sits right under the header (the stem rail from 1280px).
- Buttons press to 0.97. Every "Criar meu site" button (hero, after the questions, closing call, header, phone menu, the dashboard's first site) has the specular finish (E18, `create-site-button.tsx`): a cream light on its rim that follows the mouse, quieter on the header's smaller button (still, on the top-left, on touch screens and with reduced motion). The light is its own layer moved only with transform, eased once per frame toward the cursor; the button's box is read on enter, scroll and resize, never on a move. Inside, the sheen stays at 4% so the white text keeps at least 4.5:1.
- Price card glow (E18): the card has its own face (`.glow-card::before`) above the blurred halo, so the halo only ever shows outside the card, even while the card is its own layer (E31: it showed as a green and amber blur inside).
- Price card glow turn (E18): the lit arc turns round the border once every 12s at rest (a CSS animation of `rotate` on its own layer); the mouse takes over, easing the short way round to the cursor, and the turn resumes from where it stopped. Touch screens keep the turn; reduced motion keeps a still glow. Paused off screen and in a hidden tab.
- Section links (E18, `anchor-scroll.tsx`): Como funciona, Preço and Dúvidas scroll there in 600 to 900ms (longer for longer distances) with an ease-in-out curve, stop under the header, focus the section title and put the "#" in the address; from another page the home page opens and then scrolls. A wheel, touch or key stops it; reduced motion jumps.
- Mouse vine (E18, quieter in E31, on every page but the team's area since E31, `vine-trail.tsx`): one thin stem, no leaves, at most about 140px of tail along the path, 2px at its widest with a fine tip at the cursor, stem green at 0.28 opacity, a slight sway; it shrinks and is gone 0.4s after the mouse rests. Over the whole public page with a mouse, only in the free space: each segment fades out within 10px of text, links, buttons, cards, fields, images, the questions' window, the header and the footer (the content's boxes are measured when the layout changes, never on a frame). One plain 2D canvas that clears only the box it drew (measured far lighter than the WebGL ribbons it replaced). Off on touch screens and with reduced motion.
- Click sparks (E31, `click-sparks.tsx`): a press anywhere on the public pages and the signed-in area bursts 7 rounded strokes (5 on touch, shorter), 8 to 14px long, in `--pollen` yellow only, that fly 18 to 28px out, shorten, thin and fade in 450 to 600ms (ease-out). One fixed canvas (z-index 15: over the content, under the header, menus and dialogs) made on the first press; the loop runs only while strokes live, at most 40. Never in the team's area (`/admin` and the admin host), never on a field people type in (text, password, email, textarea, select), never with reduced motion; the press itself is never stopped.
- Everything is disabled under `prefers-reduced-motion`.

## Layout

There is no live preview (owner decision of 2026-10-27, removed in E10).

- Desktop (≥1280px): questions rail | the form's card on the table.
- Below 1280px: the form only; the progress ("Passo N de 5" and a horizontal stem) sits under the header.
- Phones: a sticky footer holds "Voltar" and the next button, within thumb reach.
- Meus sites (`/meus-sites`, E26): the title with the greeting, email and *Perfil e segurança* under it, *Criar outro site* and the bell beside it; a quiet account band only when there is a notice; then one card per site, ordered by urgency (needs attention, renewal, choose a direction, publish, draft, then the rest by latest change). Each card: the name and a status badge (a dot and a label, the colour never alone: pollen for *Sua vez*, a pulsing leaf while working, a steady leaf on air, red for a problem), one sentence, one main button (filled only when the site waits on the person; outline otherwise) with *Detalhes* and *Ver o site* beside it, then a quieter details block under a line (dates, milestones, what publishing included, *Guardado até…*, *Descartar*). A card waiting on the person has the one highlight: a 4px pollen border on its left and the badge; its action appears once on the page (Von Restorff). The card is a list item named by its heading and described by its badge, so a screen reader hears name, status, then the action. No horizontal scroll at 360px; 44px targets (16px between wrapped rows).
- Account pages (`AuthShell`): one white card (16px radius, line border, soft tinted shadow) centered on the paper, 28rem wide (sign-up: 40rem from 768px, in two columns: name and email, then the password and its confirmation, side by side). Sign-in (`/entrar`) and sign-up (`/cadastro`) are the same frame with a different card, and both carry the morning light behind the card, never over its text (owner's decision of 2026-11-05). The password pages use the same card without the light.
- Visitor's header (E30): on the right, **Entrar** (a quiet pill: ink, a soft wash on hover) then **Criar conta** (the green specular pill, the header's one highlight), 44px tall, the same radius, focus ring and press, 10 to 12px apart; never the screen the person is on, neither on the password screens. The right column is 14rem from 768px and 16rem from 1024px in every state, so the middle links never move (checked at 768, 820, 1024, 1280 and 1440px); the phone menu still takes over below 768px.
- Account screens without a footer (E30): sign-in, sign-up and both password screens; the card centres under the header, at least 24px below it (16px for the small cards on short screens), and below 700px of height every card eases padding, gaps and fields (44px) so all fit 1366×650 and 1280×600 with no scroll. Sign-up: the password's strength and bar only while typing, *Mínimo: 8 caracteres* under the password, the terms in one line at a normal line height, the button across the card, *Já tem conta? Entrar* under it.
- Main button (E30): solid green with the specular finish (`components/ui/specular.tsx`: a rim light and a sheen that follow the cursor, the press at 0.97) is the main action, at most one per view: the default variant of `Button` and `CreateSiteButton` share it. Outline, ghost, link and destructive buttons never have it. Disabled or busy, the light stays at rest.
- No repetition (E29): the footer holds only the Terms, the Privacy Policy and the contact line (Ajuda and the account live in the header); menus never list the current page; the account screens drop *Entrar ou cadastre-se* from the header; a form shows each error once, under its field (no summary at the top). The terms sentence keeps *e a* with its link, so it never ends a line alone. In *Meus sites*, the site's name links to its page and the card has one button; the live address shows once, under *Endereço*.
- Rhythm (E27): the card breathes (padding 32 to 36px, 28px between rows, title 2rem, 52px fields). Sign-up: name and email, then the password (strength on its label row, a 4px three-part bar under it) and its repetition (a feedback line of kept height), the pills across both columns, then the footer behind a hairline: the terms sentence on the left (lines 44px apart so each link keeps its tap area), the button on the right, *Já tem conta? Entrar* under the terms; one column on phones. Sign-in: *Ainda não tem conta? Cadastre-se* as a note under the title, the fields, the button, *Esqueci a senha* under it (owner's request, E27). The forgot and reset pages share the rhythm; reset uses the same pills and bar.
- They fit (E26; E30 without the footer): the header and the card fit 1366×650 and 1280×600 with no scroll, sign-up included. Below that the card is never cut and the page scrolls. Only the light's own layer hides overflow, and below 700px of height the small cards ease padding, gaps and fields (44px). Turnstile shows only when it needs a click (`appearance: interaction-only`). Checked by `e2e/auth-fit.spec.ts` at 1366×650, 1280×600, 1024×768, 768×1024, 390×844 and 360×640.
- Morning light and the mouse (E31): the beams turn toward the cursor by about 24° across the page (`mouseInfluence` 0.7; it was 0.12, about 4°, hardly seen) and the beam under it brightens.
- Morning light, moving again (E30): measured, the E27 beams were so wide (spread 4.6, density 1.6, sharpness 0.02) that the WebGL layer was a flat veil, running at 0.24 time units a second under a still glow: nothing visible moved. The beams are shapes again (spread 1.6, density 5, sharpness 0.35), the clock runs at 1 a second (changes over a few seconds), and once they draw the still beams step out and the halo eases to 70%. It moves only with a GPU, with motion allowed, on screen and in a visible tab; with reduced motion it is the still light (no canvas). `e2e/morning-light.spec.ts` proves the clock runs, the frame changes and it pauses in a hidden tab.
- Morning light (E26, softened in E27, `morning-light.tsx`): light through a window, not stripes. Colours from tokens, more light than pigment: `--morning-pollen` (#F3DFA0) and `--morning-leaf` (#CFE3C4) for the static layer, `--morning-ray` (#EBC566) and `--morning-ray-leaf` (#A9D1A8) for the hue of the moving beams (the shader keeps only the hue and no longer squares or darkens it, which was what turned the gold olive). The static layer is the light itself: a wide halo centred behind the card (the card rests in the light), the top right corner's glow and a few broad beams blurred by 22px; it is what a visitor sees without WebGL, with reduced motion and before the script, and the moving WebGL beams (sharpness 0.02, density 1.6, wide spread, low glow, device pixel ratio 1) only add a slow shimmer on top, so there is no jump when they load. The whole layer starts behind the frosted header and dissolves at every edge (a gradient mask): no hard line under the header. Calmer than in E26, still clearly visible at 360, 768 and 1280px; text outside the card never sits on strong light.

## UX laws

Every interface change is reviewed against [ux-laws.md](ux-laws.md) (its checklist) before the step is done, and the PR summary lists the laws touched and any conflict. Rules that shape this design system:

- One filled button per block; the same action is never highlighted twice.
- Every target has its own 44px area.
- A field's error sits right under it, before its hint.
- Every click shows a change in under 400ms (busy state on the button).
- Destructive actions sit apart from the main one and ask for confirmation.
