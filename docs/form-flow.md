# Form flow (5 steps)

Target flow from the master plan (2026-10-27), built in step E10. Since E25 (owner's decision of 2026-11-05) the form has 5 steps, the ones that ask for information; choosing the look and publishing come after them, on the site's own pages, and are not numbered. The word is *passo* everywhere the client reads it. It replaces the previous flow (business, template, colors, sections, content, contact, address) and removes the live preview: the client no longer sees the site while answering.

UI copy shown to the client is in pt-BR; labels quoted below are the actual pt-BR texts.

## Principles

- One main question per screen. Plain, informal language.
- Draft saved at every step: the client can close the page and come back later.
- Per-step validation with the schema, with clear error messages in Portuguese.
- No live preview. Generation is asynchronous: after sending, the client follows the status on *Meus sites* (`/meus-sites`, "Painel" until E26).

## Sign-in

Signing in is required to create a site (decision of 2026-10-27, replacing the decision of 2026-10-21 that left it optional until publishing). An account comes before step 1: sign-up with name, email, password and the accepted terms, the email confirmed by link (E15); after that, sign-in by password or by a link sent to the email. The draft is saved in the account at every step, and the directions and the finished site appear on the client's dashboard.

## Steps

1. **Negócio (business):** name, category (searchable list from `docs/categories.md`), city and state, short description (up to 500), founding year (optional: the field shows what is typed and the draft gets the year at 4 digits; "Use 4 números, como 1998." only after leaving the field or trying to move on, E38). A blocked category stops here, with a kind explanation and no charge. Optional but encouraged questions that make the site specific: how it started, what only they do, what clients praise most, a detail of the neighborhood or city, the most requested item or service.
2. **Marca e sensação (brand and feeling):** logo upload (optional), brand colors (optional, up to 3), up to 2 feelings among acolhedor, elegante, moderno, robusto and ousado. Without a logo, the system generates a monogram.
3. **Seções (sections):** the system suggests the family's sections; the client turns them on or off. Testimonials only turn on with a real testimonial.
4. **Conteúdo (content):** services or products (name, short description, up to 9), differentiators (up to 8, short), FAQ (optional), real testimonials with name and authorization, photos (up to 12, with a guide on how to take them). Image authorization confirmation when people appear, and parents' or guardians' authorization when minors appear.
5. **Contato (contact):** WhatsApp, phone, email (at least one channel). Full address, or "não tenho endereço fixo" with a list of neighborhoods or cities served. Structured opening hours, day by day (E38):
   - one card per day, open or closed, with up to 3 intervals of its own;
   - "Copiar o horário de [dia] para…" Seg a Sex, Seg a Sáb or Todos os dias. It only copies: each day can change alone afterwards;
   - same time to open and close, and overlapping intervals, are flagged next to the day; an interval past midnight shows "Fecha depois da meia-noite";
   - a summary follows the list ("Seg a Sex 08:00–18:00; Sáb 08:00–12:00; Dom fechado");
   - the "sob agendamento" and "24 horas" options stay;
   - the draft keeps the schema's rules unchanged: days with the same hours share one rule (`apps/platform/src/lib/hours-days.ts`), and drafts saved with groups of days open as they were.

   Instagram and Facebook (E38):
   - a pasted link (any of the network's addresses, `m.`, `fb.com`, `?igsh=...`) or "@nome" becomes the name;
   - typing keeps every letter;
   - the message says the cause (spaces, characters, length, another network's link, `profile.php`), on leaving the field or moving on, with the same words as the server (`packages/schema/src/v1.2/social.ts`).

   Professional registration when the family requires it.
The 5th step ends with a short look at the answers of steps 1 to 4 (each with a link back) and **Enviar e ver as direções**: the answers are saved, the directions are requested and the client goes to the site's page. Drafts saved by the former 7-step form may list `direcao` and `endereco` as done; they are ignored when read (`knownSteps`), the answers stay.

## After the 5 steps (not numbered)

- **Escolha da direção (direction choice, asynchronous):** the client can close the page after sending. When the 3 directions are ready, the dashboard shows the "Escolha uma das 3" card. 3 free rounds per site (the first and 2 redos), then 1 more round per hour; the count never resets, and choosing is never blocked (values in `apps/platform/src/config/limits.ts`). Choosing one locks the identity. "Nenhuma serviu: criar outras 3" opens "O que você não gostou?" (E41) before the round is spent: optional chips (Mais sóbrio, Mais colorido, Mais moderno, Mais clássico, Mais claro, Mais escuro, Layout diferente, Outras fontes; opposite pairs replace each other) and an optional note of up to 140 characters (checked against the blocked topics, cleaned, sent to the art director only as data). "Criar outras 3" sends them; "Criar sem dizer o motivo" skips them. They travel in the round's job payload (`feedback`); the job validates them again. The next round is always far from, and visibly different from, the earlier ones (`docs/art-direction.md`, Redo).
- **Publicar (`/meus-sites/<site>/publicar`):** subdomain choice (validation and availability in real time), summary of the answers, the finished-site screen, change requests, approval and payment (stub). Before a direction is chosen it only says what comes first.
- **Gerenciar o site (E42, on the site's page, once published):** "Tirar do ar" (one confirmation; reversible, nothing deleted; "Recolocar no ar" brings it back), and "Excluir o site" in steps: what is deleted and what stays, the .zip download, then typing the address; the site goes offline at once and is deleted after `deletionWaitDays` (7), with "Cancelar a exclusão" until then. When the team took the site offline or scheduled its deletion, the section shows the reason it chose to show and the contact address, without a button to undo it. No refund is promised: a neutral line points to the contact address (pending owner decision). Not shown for suspended or unpublished sites (an unpublished one is still discarded, E24).

Old addresses keep working (permanent redirects in `apps/platform/next.config.ts`): `/criar/<site>/direcao` leads to the site's page, `/criar/<site>/endereco` to Publicar, and `/criar/<site>/etapa/<passo>` to `/criar/<site>/<passo>`.

## Minimum to generate

Name, category, city, at least one contact channel, and (one service, or a description of 60 characters or more).

## Missing data

Nothing is invented and nothing shows up empty:

| Missing data | Behavior |
| --- | --- |
| WhatsApp | The main button becomes "Ligar"; without a phone, "Enviar e-mail" |
| Phone | No call button |
| No channel at all | Blocks |
| Full address | The address block and "Como chegar" disappear |
| Service area only | "Atendemos em {list}" |
| Opening hours | The block does not appear |
| Logo | Generated monogram |
| Photos | No gallery; typographic hero, gradient with grain or a pattern; never a generated photo |
| Photo for "Sobre" | Text only, with an adjusted layout |
| Social networks | The icon does not appear |
| Description | The AI writes only from the facts given; without enough facts, "Sobre" is turned off |
| Tagline | Suggested by the AI (marked as generated) |
| Testimonials | Section turned off |
