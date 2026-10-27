# Catalog promotion cycle and restricted code layer (later phase)

The catalog grows with real use, without losing diversity.

## Metrics (per variant and per composition)

Composition = the set of choices in one direction (the variant of each section, font pair, ornaments, base palette), identified by a hash. Record: times suggested, times chosen among the 3, approved on the finished site, change requests, reviewer findings by severity, admin decisions and review time.

## Admin actions (E11)

- Mark a composition "recommended": higher weight in the art director's draw.
- "Retire" a composition or variant: zero weight.
- "Request a new variant": creates a task for the factory (E6).

Rules: weights have a cap, and there is a minimum exploration quota (for example, at least 20% of suggestions drawn outside the recommended ones). The minimum distance between sites of the same family and city always applies. Weights never override contrast, photo requirements or review.

## New variants

Only through the factory: four mandatory states, automated tests, the reviewer agent and the owner's approval. Each variant has a version and a fingerprint.

## Restricted code layer (later phase, OFF)

Future goal: the AI proposing a new section variant in HTML and CSS with no JavaScript. Unlocked only if the blind test (`blind-test.md`) shows a real gain over pure composition. Switch `AI_CODE_VARIANTS=false` by default.

Requirements, when implemented:

- Restricted dialect: no JavaScript, no external `url()`, no `@import`, selectors scoped to the components, no own `@keyframes` or `transition`, only `data-anim` attributes.
- Sanitizer and CSP (E7), four states, contrast, overflow, axe, reviewer agent and human review.
- Generated code is stored as versioned data, separate from the content, and frozen after approval. It is never regenerated automatically. A defect is fixed case by case or by promotion to the catalog.
- Good, reviewed variants are promoted to the catalog and become our own tested code.

This round: implement only the sanitizer and the dialect validator (E7), the switch turned off and an empty interface. DO NOT implement generation.
