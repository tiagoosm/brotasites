# Main site implementation plan

Implements `docs/superpowers/specs/2026-10-24-main-site-design.md`. Each step ends with lint, typecheck and the relevant tests passing, and its own commit.

## 1. Site shell and routes

- Add the `(site)` route group in `apps/platform/src/app` with a layout holding the header, footer and skip link.
- Replace the redirecting `src/app/page.tsx` with the home page inside `(site)`.
- Components in `src/components/site/`: `site-header.tsx` (with mobile menu), `site-footer.tsx`.
- Update `e2e/form.spec.ts`, which starts at `/`, to start at `/criar/negocio`.
- Tests: `e2e/site.spec.ts` with header links, mobile menu by keyboard (open, focus trap, Escape), footer links, single `h1`, landmarks.

## 2. Shared form pieces

- Extract from the form what the stem excerpts reuse, keeping the form's behavior and tests unchanged: category chip look, section switch look, palette swatches, door sign pill. Small presentational components under `src/components/shared/`.

## 3. Home page sections

- `src/components/site/home/`: `hero.tsx`, `specimen.tsx`, `features.tsx`, `free.tsx`, `faq-preview.tsx`, `final-call.tsx`.
- Specimen image: a script in `apps/platform/scripts/specimen.ts` renders the example site (preview server) at desktop and phone sizes with Playwright and saves PNGs to `public/specimen/`; committed, served with `next/image`.

## 4. The stem

- `src/components/site/stem/stem.tsx` reads `formSteps` and renders seven nodes; one excerpt component per question in the same folder.
- CSS in `globals.css`: scroll-driven growth of the stem line and leaf opening per node (`animation-timeline: view()`), guarded by `@supports` and `prefers-reduced-motion`.
- Tests: the seven questions in `formSteps` order; the stem is fully visible with reduced motion; no horizontal scroll.

## 5. Help

- `src/content/faq.ts`: grouped questions with slugs, a `main` flag for the four on the home page.
- `src/components/site/faq-accordion.tsx` (native `details`/`summary`, opens when its hash is in the URL), `src/components/site/toc.tsx`.
- `src/app/(site)/ajuda/page.tsx`. Tests: direct link opens the answer; table of contents reaches its section.

## 6. Terms and Privacy

- `src/content/terms.ts`, `src/content/privacy.ts` (numbered sections, last-updated date, "Versão inicial, em revisão jurídica", responsible party and contact "a definir").
- A shared `legal-page.tsx` renders sections and the table of contents. Pages `termos` and `privacidade`.

## 7. SEO

- Per-page `metadata`; `src/app/sitemap.ts`, `src/app/robots.ts`; `src/app/opengraph-image.tsx` with `next/og`; JSON-LD `Organization` on the home page and `FAQPage` on `/ajuda`.
- Test: `sitemap.xml` lists the four pages.

## 8. Wrap-up

- Update `docs/platform-copy.md` with the final copy.
- Full suite (lint, typecheck, unit, e2e for platform and templates), Lighthouse on `/` (phone and desktop, above 90 in all categories), screenshots for review.
