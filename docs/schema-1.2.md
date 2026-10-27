# Schema 1.2 (spec for the Zod schema)

Replaces version 1.1 (kept in `docs/legacy/site-config.schema.v1.1.json`). Main changes: structured opening hours, visual identity and directions, family and professional registration, service area, new sections, obsolete fields removed. Implemented in step E2.

## Root

`schemaVersion: "1.2"`, `site`, `business`, `brand`, `design`, `sections[]`, `navigation`, `seo`, `integrations`, `ai`, `review`.

## site

- `type: "landing-page"`, `language: "pt-BR"`, `timezone` (default `"America/Sao_Paulo"`).
- `subdomain`: `^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$`, no `xn--`, no double hyphen, not on the reserved names list (www, app, admin, api, ajuda, mail, ver, status, blog, suporte, login, painel, cdn, assets, static and others as needed, in `packages/schema/src/reserved.ts`; also add names that imitate banks, government bodies and well-known brands, such as banco, gov, pix, receita).
- `customDomain: string | null` (format validated here; ownership is verified by the hosting).

## business

- `name` (2 to 80), `tagline` (up to 120), `category` (id from the taxonomy in `docs/categories.md`), `family` (derived), `description` (up to 500), `foundedYear` (integer, 1900 to the current year, optional), `logo` (asset reference or null).
- `contact`: `phone`, `whatsapp` (digits only, 12 to 13, with country code 55), `email`.
  - Rule: at least one of phone, whatsapp and email.
- `address`: `hasFixedAddress` (boolean), `street`, `number`, `district`, `city`, `state` (2 letters), `zip`.
  - Rule: if `hasFixedAddress` is true, street, city and state are required. If false, `serviceArea` is required.
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
