# Main site design (home, help, terms, privacy)

Date: 2026-10-24. Approved by the project owner in chat (approach A, parts 1 to 3).

## Goal

Give BrotaSites a real public face: a home page that presents the product with the seven questions as its backbone, plus Help, Terms of use and Privacy pages. Site generation and publishing are out of scope for this work.

## Decisions

- Pages now: `/` (home), `/ajuda`, `/termos`, `/privacidade`. No pricing page and no examples gallery for now.
- Price: creating the site and seeing the preview is free; the price to publish is shown before publishing. No amounts anywhere.
- The home page presents what BrotaSites is and summarizes everything, built around the slogan "Sete perguntas e seu site pronto".
- Approach A: the seven questions are drawn as the Herbário stem growing down the page.
- Legal responsible party and contact e-mail are pending. Pages show them as "a definir" and the footer shows no e-mail.
- Visual direction: Herbário (see `docs/platform-design.md`). Copy rules: `docs/platform-copy.md` (never name the size or type of business; no invented numbers, prices or testimonials).

## Home page (`/`), top to bottom

1. **Header**, sticky and quiet: logo with sprout; "Como funciona" (scrolls to the stem) and "Ajuda"; "Entrar" and the green "Criar meu site" button. On phones: logo, "Criar meu site" and a menu with the other links.
2. **Hero**: headline "Sete perguntas e seu site pronto." (Young Serif); subheadline "Conte o que você faz, escolha cores e fotos e veja o site tomar forma enquanto responde. Sem código."; "Criar meu site" button and "Ver como funciona" link; reassurance line "Criar é grátis. Você só publica quando gostar."; beside it (below on phones) a herbarium specimen: a paper frame with a static image of the Padaria do Zé example site, held by tape, with mono labels ("pergunta 3 · cores").
3. **The stem of seven questions**: heading "Como funciona: sete perguntas."; a vertical stem grows with scrolling and opens a leaf at each node. Each node has the number, the exact question from `formSteps`, one sentence on what it solves, and a small visual excerpt of that step, built from the real form components (not screenshots):
   1. business type chips; 2. template cards; 3. palette swatches; 4. section switches; 5. a text field being written; 6. the "Aberto agora" door sign; 7. the address `seu-negocio.brotasites.com`.
   The stem ends with the sprout and "Pronto. Seu site no ar."
4. **What every site has**: WhatsApp a um toque; Aberto ou fechado, na hora; Endereço e mapa; Feito para o celular; Pronto para o Google. An editorial list, not a card grid.
5. **"Criar é grátis"**: "Montar o site e ver a prévia não custa nada. O preço para publicar aparece antes de você publicar."
6. **Questions**: the 4 main questions as an accordion, with "Ver todas as dúvidas" linking to `/ajuda`.
7. **Final call**: "Seu site está a sete perguntas de distância." and "Criar meu site".
8. **Footer**: logo, slogan, links to Ajuda, Termos de uso, Privacidade and Entrar.

The form stays at `/criar`; `/` no longer redirects to it.

## Help, Terms and Privacy

- Shared look: same header and footer, paper background, a narrow reading column (about 68 characters), Young Serif headings. Long pages get a sticky table of contents on desktop and a collapsible "Nesta página" on phones.
- **Ajuda (`/ajuda`)**: questions grouped by topic, as accordions that open from a direct link (`/ajuda#quanto-custa`). Topics: Começar (do I need to know technology, how long it takes, do I need an account); As sete perguntas (can I go back and change, no photos yet, what the preview is); Seus dados e informações (the AI never invents information, who sees the draft, how to delete the account); Preço e publicação (creating is free, when I pay, the site address). Answers that depend on open decisions (changes after publishing, custom domain) state today's truth ("ainda não está disponível") and promise nothing. There is no account deletion button yet, so that answer says deletion is done on request through the contact (pending). Ends with "Não achou a resposta?" and the contact, pending for now.
- **Termos de uso (`/termos`) and Privacidade (`/privacidade`)**: plain language, numbered sections, last-updated date, and a notice at the top: "Versão inicial, em revisão jurídica". Privacy (LGPD): data collected (e-mail, form answers, photos), purposes, where it is stored (Supabase in São Paulo; Cloudflare later for published sites), cookies (sign-in session; the draft kept on the device), data subject rights and how to exercise them. Terms: what the service does, responsibility for content and photos sent, forbidden use, the service being in development. Responsible party and contact: "a definir". These drafts do not replace legal review before accepting clients.

## Technical design (`apps/platform`)

- **Routes**: a `(site)` route group with its own layout (header and footer) for `/`, `/ajuda`, `/termos`, `/privacidade`. `/criar`, `/entrar` and `/meu-site` keep their current layouts.
- **Components**: `src/components/site/` for header, footer, mobile menu, FAQ accordion and table of contents; `src/components/site/stem/` for the stem, one small component per question excerpt. Pieces shared with the form (category chips, section switch, palette swatches, door sign look) are extracted so both use the same code instead of copies.
- **Content**: stem questions come from `formSteps` in `@brotasites/schema`. Help questions live in one content module (`src/content/faq.ts`) used by the home page (the 4 marked as main) and by `/ajuda` (all). Terms and Privacy text live in their own content modules. `docs/platform-copy.md` is updated with the new copy.
- **Animation**: CSS scroll-driven animations (`animation-timeline: view()`), as in the site template; no new library. Without support, or with `prefers-reduced-motion: reduce`, the stem is shown fully grown.
- **Hero image**: a static, optimized image of the example site (desktop and phone), produced once from the `classico` template and committed, served with `next/image`.
- **SEO**: the four pages are static (built at build time) with their own title and description; `sitemap.xml`, `robots.txt`, an Open Graph image, and structured data (`Organization`; `FAQPage` on `/ajuda`).
- **Accessibility**: one `h1` per page, landmarks (`header`, `nav`, `main`, `footer`), skip link, accordions with proper button semantics, the mobile menu usable by keyboard with focus kept inside while open, visible focus everywhere.

## Testing

Playwright, desktop and phone projects:

- Home: shows the slogan; the seven nodes show the questions in `formSteps` order; "Criar meu site" goes to `/criar/negocio`; no horizontal scroll; with reduced motion the stem is fully visible.
- Navigation: header links, mobile menu by keyboard (opens, traps focus, closes with Escape), footer links reach each page.
- Help: an accordion opens from a direct link; the table of contents reaches the right section.
- Each page has a single `h1` and the expected landmarks; `sitemap.xml` lists the four pages.
- Lighthouse above 90 in all four categories on `/`, phone and desktop.

Existing form tests that start at `/` are updated to start at `/criar/negocio`.

## Out of scope

Pricing page, examples gallery, site generation and publishing changes, platform hosting, real legal review, contact e-mail.
