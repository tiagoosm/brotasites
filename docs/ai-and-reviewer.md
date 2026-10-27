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

## Reviewer

1. **Deterministic:** AA contrast, overflow at 360, 768 and 1280 px (Playwright), valid links, no external requests, axe, weight, schema, 44 px touch targets, empty sections, cut-off text, broken image requests, `prefers-reduced-motion`.
2. **Reviewer agent:** clean context; receives screenshots, HTML, the content JSON and the original form answers. Judges hierarchy, balance, repetition across sections, generic or AI-sounding copy, fit with the business, facts that are not in the form, odd Portuguese. Structured output: findings with severity, location and suggestion.
3. **Loop:** fixable findings go back to the generator (within the catalog), at most 2 rounds. High or persistent severity: admin queue with the report attached.
4. **Calibration:** 20 sites with known defects to measure hits and false alarms. The agent is a filter and prioritizer, not the final judge. Security never depends on the agent, only on the deterministic checks.
