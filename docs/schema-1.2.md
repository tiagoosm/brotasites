# Schema 1.2 (spec for the Zod schema)

Replaces version 1.1 (kept in `docs/legacy/site-config.schema.v1.1.json`). Main changes: structured opening hours, visual identity and directions, family and professional registration, service area, new sections, obsolete fields removed. Implemented in step E2 in `packages/schema/src/v1.2` (import `@brotasites/schema/v1.2`); see "Implementation notes" at the end.

## Root

`schemaVersion: "1.2"`, `site`, `business`, `brand`, `design`, `sections[]`, `navigation`, `seo`, `integrations`, `ai`, `review`.

## site

- `type: "landing-page"`, `language: "pt-BR"`, `timezone` (default `"America/Sao_Paulo"`).
- `subdomain`: `^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$`, no `xn--`, no double hyphen, not on the reserved names list (www, app, admin, api, ajuda, mail, ver, status, blog, suporte, login, painel, cdn, assets, static and others as needed, in `packages/schema/src/v1.2/reserved.ts`; also add names that imitate banks, government bodies and well-known brands, such as banco, gov, pix, receita).
- `customDomain: string | null` (format validated here; ownership is verified by the hosting).

## business

- `name` (2 to 80), `tagline` (up to 120), `category` (id from the taxonomy in `docs/categories.md`), `family` (derived), `description` (up to 500), `foundedYear` (integer, 1900 to the current year, optional). The logo lives only in `brand.logoAsset`.
- `contact`: `phone` (digits only, with area code), `whatsapp` (digits only, 12 to 13, with country code 55), `email`.
  - Rule: at least one of phone, whatsapp and email.
- `address`: `hasFixedAddress` (boolean), `street`, `number`, `district`, `city`, `state` (2 letters), `zip`.
  - Rule: city and state are always required (step 1 asks for them). If `hasFixedAddress` is true, street is required too. If false, `serviceArea` is required and street, number and zip stay empty.
- `serviceArea: string[]` (up to 10 items).
- `openingHours`:
  - `mode`: `"schedule"` | `"byAppointment"` | `"always"`.
  - `rules[]`: `{ days: ("mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun")[], intervals: { open: "HH:MM", close: "HH:MM" }[] }`, at most 3 intervals per day.
  - Rules: 24-hour HH:MM; no overlaps; each day in at most one rule; a day with no rule is closed; `close` earlier than `open` means the interval crosses midnight.
  - `note` (up to 120).
- `social`: `instagram` (username only), `facebook`.
- `registration` (optional; required for the regulated health family and as in `docs/categories.md`): `{ council: string, number: string }`.

## brand

- `logoAsset` (or null), `brandColors` (up to 3 hex), `feelings` (up to 2 of: acolhedor, elegante, moderno, robusto, ousado).

## design

- `seed` (string), `round` (integer).
- `identity`: `personality`, `heroVariant`, `fontPair`, `palette` (colors with computed hex and guaranteed AA contrast), `shape`, `ornamentSet`, `pattern`, `imageTreatment`, `dividerStyle`, `markStyle`, `sectionVariants` (map of section to variant id), `rhythm`, `motionPreset`, `fingerprint`.
- `directionStatus`: `"draft"` | `"approved"`. `approvedDirectionId`.
- `lockedFields: string[]`: after approval includes personality, heroVariant, sectionVariants, motionPreset, markStyle.
- `overrides` (editable after approval): `colors` (only with AA contrast) and `fontPair` (only among compatible pairs).

## sections

Ids: hero, sobre, servicos, como-funciona, diferenciais, galeria, depoimentos, faq, cta-final, contato. Each item: `{ id, enabled, content }` with content validated per id.

- `como-funciona`: `steps`, 2 to 6 items `{ title, text }`.
- `diferenciais`: 3 to 8 items `{ title, text?, icon }` (icon from a closed set in the catalog).
- `depoimentos`: enabled only with at least 1 item, each with `authorized: true`.
- `contato`: `showHours`, `showMapLink` ("Como chegar" button). No `showForm`.

## navigation, seo

`navigation`: `sticky`, `ctaLabel` (up to 30). `seo`: `title` (up to 70), `description` (up to 160), `keywords`.

## integrations

`whatsappFloatingButton` (boolean). Removed: `googleMapsEmbed`, `contactForm`, `analytics`.

## ai

`tone`, `generatedFields`, `userEditedFields`, `promptVersion`, `playbookVersion`, `modelId`.

## review

`status`, `reviewerReportId`, `humanDecision`.

## Notes

- Remove `design.template` and the direct `design.colors` / `design.fonts` of version 1.1. Keep a 1.1 to 1.2 converter in `docs/legacy/` only if it is simple.
- Generate the JSON Schema from the Zod schema.

## Implementation notes (E2)

Schema 1.2 lives next to v1.1 for now. The form, templates and generator in production still read v1.1; they move to 1.2 in E5 (templates) and E10 (platform), and v1.1 is removed then. The v1.1 example is in `docs/legacy/site-config.example.v1.1.json`. A 1.1 to 1.2 converter was not written: v1.1 has free-text opening hours and no identity, so the conversion is not simple.

Decisions where this document was silent or contradicted itself:

- `business.logo` and `brand.logoAsset` were duplicates: only `brand.logoAsset` stays.
- City and state are always required, with or without a fixed address.
- Catalog ids (variants, font pairs, ornaments, presets) are checked only for format (`^[a-z0-9-]+$`) until the catalog exists (E3); the engine then checks they exist. The same goes for `overrides.fontPair` ("only among compatible pairs").
- Icons (`diferenciais`, `servicos`) come from the icons the templates already ship (`src/icons.ts`) until the catalog owns the set.
- Images are `{ assetId, alt }`: an uploaded file id (UUID) and editable alt text. No URL is ever stored.
- Buttons are `{ label, action }` with `action` among `whatsapp`, `phone`, `email`, `directions` and `section` (plus `section` as the target). The generator builds the `wa.me`, `tel:`, `mailto:` or "Como chegar" link from the contact, so the AI never produces URLs.
- `design.identity.palette` has the roles `background`, `surface`, `text`, `textMuted`, `primary`, `onPrimary` and `accent`. AA (4.5:1) is required for text on background, muted text on background, text on surface and `onPrimary` on primary, also after `overrides.colors` are applied.
- `design.identity` is null until the engine has produced the directions; `overrides` need an identity.
- `review.status`: `notReviewed`, `passed`, `changesNeeded`, `needsAttention`. `review.humanDecision`: `approved`, `changesRequested`, `suspended` or null. These are the reviewer's verdicts; the site status of `docs/product.md` lives in the database.
- `ai.generatedFields` and `ai.userEditedFields` hold dotted paths (`sections.sobre.content.text`).
- `phone` and `zip` are stored as digits (`zip` accepts `37540-000` or `37540000`); the site formats them.

Rules added because the documents require them elsewhere:

- The category must belong to the declared family (`docs/categories.md`); "outro" accepts any family.
- Testimonials cannot be enabled for psychology (`docs/categories.md`, regulated health).
- A button needs the channel it opens; the "Como chegar" link needs a fixed address; the floating WhatsApp button needs a WhatsApp number.
- Sections appear at most once each, and the page starts with an enabled hero.
- A day repeated inside one rule, an interval that opens and closes at the same minute, and opening-hours rules outside `mode: "schedule"` are refused. 24 hours is `mode: "always"`.

The JSON Schema in `docs/site-config.schema.json` is generated from Zod (`pnpm --filter @brotasites/schema json-schema`) and a test keeps it in sync. It covers field formats only: the rules above live in Zod.
