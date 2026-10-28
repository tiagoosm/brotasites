# AI and reviewer

## Providers

Interfaces `EngineProvider` (deterministic) and `AiProvider`. The system runs on the engine alone if the AI fails. A "simulated" mode for tests and development makes no API calls. The model comes from an environment variable (`AI_MODEL_ID`); do not pin model names without checking the official documentation.

## Art director (composition)

Input: business data (sanitized and delimited as data), family, chosen feelings, photo requirements, round and seed. Output: JSON validated by Zod in which every value is a catalog id (variants, font pairs, ornaments, patterns, presets): closed enums, no free text beyond allowed labels, no URL, no JavaScript. It produces the 3 directions ("Fiel à marca", "Evolução", "Contraste"); the engine checks AA contrast and diversity and applies the minimum design distance from existing sites of the same family and city. Cache by input hash. Failed twice: the engine works alone.

## Copy

A playbook per family in `packages/ai/playbooks/{family}.md`, versioned: vocabulary, an informal and local tone in Brazilian Portuguese, good examples written by a person, a list of banned phrases (clichés such as "excelência", "qualidade e compromisso", "soluções sob medida", "descubra", "venha conhecer", "experiência inesquecível"), specificity rules (use the facts from step 1 of the form). The playbooks' instructions are in English; their example copy is in pt-BR. A second pass rejects generic copy. Fact checking: every number, phone, address, year or name in the output must exist in the input; otherwise the output is discarded.

## AI security

Client text goes in as delimited data, never as an instruction. The AI has no tools and no secrets. Its output is only validated JSON. A corpus of prompt injection tests (hidden instructions in the name, description, services, FAQ). Limit of rounds per site and per day (default 20), per account, a global budget with an alert, and the cost of each round measured.

## Evaluations

A fixed set of 30 fictional businesses. Metrics: JSON validity, no invented facts, no banned phrases, diversity across directions, distance between sites. When a playbook or a prompt changes, CI shows the effect on the 30 cases.

## Implementation (E8)

In `packages/ai`. The rest of this document is the specification; this section says where each part lives.

- **Providers.** `AiDirector` implements the engine's `EngineProvider`, so the platform calls it like the engine, plus `writeCopy` for the text. Models sit behind `ModelClient`: `AnthropicModelClient` (Claude through `@anthropic-ai/sdk`), `SimulatedModelClient` (no API call: the engine's choices and the client's own text) and `ScriptedModelClient` (fixed answers, for tests). `aiProviderFromEnv` builds it from `AI_MODE`, `AI_MODEL_ID`, `AI_EFFORT` and the limits in `.env.example`.
- **Request.** One Messages request per task: the instructions as a cached system block, the client data in a `<client_data>` block (JSON, with `<`, `>` and `&` escaped so the data cannot close the block), structured outputs with the task's JSON schema, adaptive thinking at the configured effort, server-side refusal fallbacks (`fallbacks: "default"`). No tools, no sampling parameters. Refusals, cut-off answers and API errors become `ModelError`.
- **Art director** (`composition.ts`). The answer schema is built per site: every value is an enum of the catalog ids this site may use. The engine's `composeDirections` then checks personality fit, builds the palettes (AA always holds) and the distances; any problem rejects the whole proposal with its reasons.
- **Copy** (`copy.ts`, `playbooks/`). The schema follows the site's enabled sections; service names, prices, icons, photos, contacts, hours and testimonials are not in the answer, so the AI cannot change them. `applyCopy` keeps every path in `ai.userEditedFields`, records `generatedFields` and the prompt, playbook and model versions. Playbooks: `common.md` plus one per family of this round (`food.md`, `beauty.md`, `events-creative.md`), `general.md` for the others; each has a version in its front matter.
- **Checks.** `checkFacts` (`facts.ts`): numbers, number words, emails, @handles and proper names must be in the client's data; links and claims such as awards, rankings and certifications are refused. `checkStyle` (`style.ts`): banned phrases of the playbooks, a hero with no fact of the business, exclamation marks, markup. Both run on every answer; the final config is validated against schema 1.2.
- **Fallback.** Rejected answer: one retry, with the reasons; rejected again, the engine alone (`draftCopy` for the text: the client's own words). The engine fails too: `NeedsAttention`, for the caller to set the site to "needs attention" and alert the admin (E10, E11).
- **Limits and cost** (`limits.ts`, `prices.ts`). `SpendingGuard`: rounds per site and per account per day per task (defaults 20 and 40), a global daily budget (default US$ 20) with one alert per day at 80%. Past a limit the engine works alone. The cost of every call is computed from the token usage and the checked price table. In memory now; Supabase tables in E10.
- **Cache** (`cache.ts`). Keyed by the hash of task, model, prompt version, playbook version and input. A cached composition is checked again against the current neighbors.
- **Prompts** (`prompts.ts`): versioned (`ART_DIRECTOR_PROMPT_VERSION`, `COPY_PROMPT_VERSION`); change the version with the wording.
- **Evaluations** (`src/evals`). The 30 businesses (`businesses.ts`), the injection corpus (`injection.ts`) and `evaluate`, which reports JSON validity, answers with invented facts, banned phrases or a generic hero, how many results came from the AI, diversity across directions, distance between sites of the same family, and cost. CI runs it in simulated mode and prints the summary (`test/evals.test.ts`); `pnpm --filter @brotasites/ai eval` runs it with the model in the environment.

## Reviewer

1. **Deterministic:** AA contrast, overflow at 360, 768 and 1280 px (Playwright), valid links, no external requests, axe, weight, schema, 44 px touch targets, empty sections, cut-off text, words broken in the middle of a heading or other large text, broken image requests, `prefers-reduced-motion`.
2. **Reviewer agent:** clean context; receives screenshots, HTML, the content JSON and the original form answers. Judges hierarchy, balance, repetition across sections, generic or AI-sounding copy, fit with the business, facts that are not in the form, odd Portuguese. Structured output: findings with severity, location and suggestion.
3. **Loop:** fixable findings go back to the generator (within the catalog), at most 2 rounds. High or persistent severity: admin queue with the report attached.
4. **Calibration:** 20 sites with known defects to measure hits and false alarms. The agent is a filter and prioritizer, not the final judge. Security never depends on the agent, only on the deterministic checks.

## Implementation (E9)

In `packages/reviewer`. `reviewSite` runs the whole review; each part can also be called alone.

- **Config checks** (`checkConfig`): schema 1.2, AA contrast on the colors the site is built with (identity plus the client's overrides), an enabled "Sobre" with no text, services with only names, text that stops exactly at a field's limit without a final stop.
- **Built files** (`checkBuild`, no browser): every resource is local (pages, `srcset`, CSS `url()` and `@import`); no script except JSON-LD, no event handler, no `iframe`, `object`, `embed`, `base` or `form`; no inline style (the strict CSP would block it); every link passes `isSafeHref`, every `#anchor` has its target, every local link and resource exists; every image has alt text; weight within `WEIGHT_BUDGET` (1.5 MB for the page, 8 KB gzipped for the script, 600 KB per image). Scripts, handlers, forbidden tags, unsafe links and outside requests are security findings.
- **Browser** (`checkInBrowser`, Playwright and axe): at 360, 768 and 1280 px, with reduced motion: content past the screen edge (the template clips sideways overflow, so this looks for cut content, not only for a scrollbar), text cut by its box, a word of a heading or of other large text (28 px and up) broken across two lines (a title too large for its column; breaks at a hyphen are fine), touch targets under 44 × 44 px (links inside a sentence are exempt, as in WCAG 2.5.8), axe WCAG 2.1 AA, failed requests, content still invisible with reduced motion. Every request that does not go to the site is blocked and reported. Returns the screenshots for the agent (360 and 1280 px).
- **Agent** (`ModelReviewerAgent`): one Claude request with the screenshots, the page's text and, delimited as data, the site's content and the client's own answers. Structured output: findings with severity, category (hierarchy, balance, repetition, generic copy, fit, invented fact, Portuguese, other), section, a pt-BR message and the fix it suggests. A bad or missing answer becomes a finding for a person, never a pass. `SimulatedReviewerAgent` applies rules instead (repeated titles, facts not in the answers, banned phrases, European Portuguese), with no API call. `reviewerAgentFromEnv` follows `AI_MODE`.
- **Loop** (`reviewSite`). Fixes inside the catalog: another variant for the section (layout problems and the agent's "swap-variant"), the text rewritten by the copy step (`rewriteCopy`, told the findings), the colors pulled back to AA. At most 2 fix rounds. A security finding stops at once. Result: `passed` (nothing above low), `changesNeeded` (medium findings left for the human review) or `needsAttention` (security, a high finding left, or a finding that came back after a fix), with every round's findings and fixes for the admin queue.
- **Calibration** (`@brotasites/reviewer/calibration`, `pnpm --filter @brotasites/reviewer calibrate`): 20 sites with one known defect each and 5 clean sites, built from the 1.2 fixture. Current result: 20 of 20 defects caught, no false alarm; the 7 variant-matrix sites (every variant in the catalog) also come out clean. CI runs it in the browser suite (`test:e2e`) and fails on a miss or a false alarm.
- **Where it runs.** The browser checks need Chromium, so in production the review runs in the generation job's worker, not in a Vercel function; the queue chosen in E10 must allow it (to verify then).

