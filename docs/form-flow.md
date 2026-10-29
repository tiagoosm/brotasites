# Form flow (7 steps)

Target flow from the master plan (2026-10-27), built in step E10. It replaces the previous flow (business, template, colors, sections, content, contact, address) and removes the live preview: the client no longer sees the site while answering.

UI copy shown to the client is in pt-BR; labels quoted below are the actual pt-BR texts.

## Principles

- One main question per screen. Plain, informal language.
- Draft saved at every step: the client can close the page and come back later.
- Per-step validation with the schema, with clear error messages in Portuguese.
- No live preview. Generation is asynchronous: after sending, the client follows the status on "Meus sites".

## Sign-in

Signing in is required to create a site (decision of 2026-10-27, replacing the decision of 2026-10-21 that left it optional until publishing). An account comes before step 1: sign-up with name, email, password and the accepted terms, the email confirmed by link (E15); after that, sign-in by password or by a link sent to the email. The draft is saved in the account at every step, and the directions and the finished site appear on the client's dashboard.

## Steps

1. **Negócio (business):** name, category (searchable list from `docs/categories.md`), city and state, short description (up to 500), founding year (optional). A blocked category stops here, with a kind explanation and no charge. Optional but encouraged questions that make the site specific: how it started, what only they do, what clients praise most, a detail of the neighborhood or city, the most requested item or service.
2. **Marca e sensação (brand and feeling):** logo upload (optional), brand colors (optional, up to 3), up to 2 feelings among acolhedor, elegante, moderno, robusto and ousado. Without a logo, the system generates a monogram.
3. **Seções (sections):** the system suggests the family's sections; the client turns them on or off. Testimonials only turn on with a real testimonial.
4. **Conteúdo (content):** services or products (name, short description, up to 9), differentiators (up to 8, short), FAQ (optional), real testimonials with name and authorization, photos (up to 12, with a guide on how to take them). Image authorization confirmation when people appear, and parents' or guardians' authorization when minors appear.
5. **Contato (contact):** WhatsApp, phone, email (at least one channel). Full address, or "não tenho endereço fixo" with a list of neighborhoods or cities served. Structured opening hours: day chips, shortcuts ("Seg a Sex", "Seg a Sáb", "Todos os dias"), "copiar para os outros dias", "sob agendamento" and "24 horas" options. Instagram and Facebook. Professional registration when the family requires it.
6. **Escolha da direção (direction choice, asynchronous):** the client sends the answers and can close the page. When the 3 directions are ready, the dashboard shows the "Escolha uma das 3" card. Unlimited redos. Choosing one locks the identity.
7. **Endereço e revisão (address and review):** subdomain choice (validation and availability in real time), summary of the answers, the finished-site screen, change requests, approval and payment (stub).

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
