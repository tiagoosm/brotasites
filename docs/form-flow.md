# Form flow (landing pages)

Goal: the client answers in a few minutes and gets the site live, without seeing any code. Each step fills in one part of the configuration JSON (`site-config.schema.json`).

UI copy shown to the client is in pt-BR; labels quoted below are the actual pt-BR texts.

## Principles

- 7 short steps, one main decision per screen.
- Live preview of the site beside the form (or above it, on mobile) on every step, updated on each change.
- Autosave on every step: the client can close the page and come back later.
- Per-step validation with the schema, with clear error messages in Portuguese.
- Everything the AI generates is shown as an editable suggestion, never as something already approved.
- Mobile-first layout, since many clients will fill it out on their phones.

## Steps

### 0. Sign-in
- Email sign-in (magic link), no password.
- Creates the user record and a draft site.
- Decision (2026-10-21): sign-in is **optional until publishing**. Anyone can start answering right away; the draft is saved on the device. Signing in (offered in the questions rail and header) keeps the draft in the account and on every device. Publishing will require it. This keeps the first screen free of friction.

### 1. Your business
- Fields: business name, type/category (list with an "other" option), city.
- JSON: `business.name`, `business.category`, `business.contact.address.city`.
- The selected category preselects the template, palette and suggested sections.

### 2. Template
- Cards for 4 templates (`classico`, `moderno`, `minimalista`, `vibrante`), each previewed with the business name already filled in.
- JSON: `design.template`.

### 3. Colors and fonts
- Ready-made palettes suggested for the category, plus a free color picker for those who want it.
- Font pairings from a closed list (heading + body).
- Automatic poor-contrast warning (text unreadable on the background) before moving on.
- JSON: `design.colors.*`, `design.fonts.*`, `design.style.*`.

### 4. Sections
- List with on/off toggles and adjustable order: hero, about, services, gallery, testimonials, FAQ, final call to action, contact.
- Sections recommended for the category come enabled by default.
- JSON: `sections[].enabled` and the order of the array.

### 5. Content
- One enabled section at a time, with its text fields.
- A "Sugerir com IA" ("Suggest with AI") button on each text field: the client describes it in one sentence and the AI proposes the text (using the tone chosen in `ai.tone`).
- Fields edited by hand go into `ai.userEditedFields` and are not overwritten on regeneration.
- JSON: `business.tagline`, `business.description`, `sections[].content`, `seo.*`.

### 6. Contact and images
- WhatsApp, phone, email, address, opening hours, Instagram.
- Logo and photo upload, with size and format limits, and automatic resizing.
- JSON: `business.contact.*`, `business.social.*`, `business.logo`, section images.

### 7. Site address and review
- Subdomain choice, with real-time availability check.
- Final summary with a full-screen preview and a payment button.
- JSON: `site.subdomain`.

### 8. Tracking
- Status screen: "gerando" (generating) → "publicando" (publishing) → "no ar" (live), or "em revisão" (in review) if something fails.
- On completion: site link, a share-on-WhatsApp button and a "pedir ajuste" ("request a change") shortcut.

## AI rules (important)

- Never invent testimonials, reviews, numbers, awards, certifications or contact details. These fields only contain what the client provided.
- The testimonials section can only be enabled if the client provides at least one real testimonial.
- Factual content (prices, opening hours, address, years in business) comes only from the form; the AI only rewrites and organizes it.
- AI output is always JSON validated by the schema; if it fails, retry once and then flag the site for review.

## Open questions

- How many templates to ship at launch (starting with 2 or 3 polished ones may be better than 4).
- Payment before or after generation (before reduces the cost of test runs without a purchase; after lets the client see the result before paying).
- Policy for included adjustments after publishing.
