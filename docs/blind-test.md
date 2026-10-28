# Blind test ("does not look like AI" criterion)

Before opening sales: gather 20 to 30 sites (half made by BrotaSites, half made by hand) and show them to 10 to 20 people, small business owners and designers, in random order, asking "qual foi feito por IA?" and "qual você preferiria ter?".

Target: people do not guess above chance, and they prefer the generated sites in at least half of the pairs. Step E13 builds the kit: anonymized static pages, an answer sheet and instructions.

If the target fails: invest in the catalog (new variants and photo treatments), in the copy playbooks and in the reviewer's criteria, and repeat.

## The kit (`apps/jobs`, `pnpm --filter @brotasites/jobs blind-test <command>`)

The test runs in pairs: 10 fictional businesses from the evaluation set (`packages/ai/src/evals/businesses.ts`, 4 food, 3 beauty, 3 events), each one made twice from the same answers: once by BrotaSites, once by a designer by hand. 20 sites in all. Each participant sees the 10 pairs and, for each, answers the two questions with A or B.

Everything goes into one folder (`--out`, default `apps/jobs/kit/`, gitignored):

```
kit/
├── briefs/<business>.md      the brief for the designer (pt-BR): the same facts, the same rules
├── generated/<business>/     the BrotaSites half (from `generate`)
├── hand/<business>/          the hand-made half, delivered by the designers (index.html + files)
├── participantes/            what participants see (from `assemble`)
│   ├── index.html            instructions and the list of pairs
│   ├── par-01.html ...       one page per pair: "Site A" and "Site B"
│   ├── ficha.html            printable answer sheet
│   └── sites/01 ... 20/      the sites under neutral numbers
└── chave/                    never shown to participants
    ├── chave.json            which number is which, pair by pair
    └── respostas.csv         the spreadsheet to fill in: participante;perfil;par;ia;prefere
```

### 1. Generate the BrotaSites half

```
AI_MODE=live AI_MODEL_ID=... ANTHROPIC_API_KEY=... pnpm --filter @brotasites/jobs blind-test generate [--photos <folder>]
```

Each business goes through the real pipeline: the engine's three directions (each business takes one of the three in turn, so the kit shows all of them), the AI copy, the reviewer (deterministic checks, the browser checks and the reviewer agent) and the generator. Only the human review is skipped. A site that the reviewer sends to "needs attention" is reported with the reason and left out; fix the cause and run again.

- `AI_MODE=simulated` (the default) works without any key, for a dry run; the copy then comes from the simulated provider and is not representative. The real test needs `AI_MODE=live` (cost: about one site's generation each, see `docs/ai-and-reviewer.md`).
- Photos are optional: `--photos <folder>` (paths are relative to `apps/jobs`) with one subfolder per business (`<folder>/padaria-do-ze/*.jpg`); file names become the alt text (`paes-no-balcao.jpg` → "Paes no balcao"; rename them with care). The designer gets the same photos. Without photos both versions have none. Use photos you have the right to use.

### 2. The hand-made half

Send each designer the brief in `briefs/` (and the photos, if any). Same rules for both versions: one page, content only from the brief, nothing invented, no contact form, no embedded map, no cookies, no requests to other addresses, relative paths, no signature or tool name in the page or the code. They deliver a folder with an `index.html`, which goes to `hand/<business>/` (the folder name is the brief's file name).

### 3. Assemble

```
pnpm --filter @brotasites/jobs blind-test assemble [--seed <text>]
```

Draws a number from 01 to 20 for each site and, in each pair, which one is A. It copies both halves into `participantes/sites/`, anonymized the same way: comments, generator tags, canonical addresses and tool names in attributes and file names removed, `noindex` added, and the generated sites' paths made relative. It lists missing hand-made sites and warns about anything that still gives a site away or would break it (an absolute path). The same seed always draws the same kit.

### 4. Run the test

- Serve the folder: `pnpm --filter @brotasites/jobs blind-test serve` (http://127.0.0.1:4600), or upload `participantes/` to any static host behind a private link. Do not open the files directly from the disk: the sites' scripts need a server.
- Each participant gets the start page and the answer sheet (printed or copied). Start each participant at a different pair (participant 1 at pair 1, participant 2 at pair 2, and so on) to spread the order effect; the pair pages link to the next one.
- Do not say who made the product or which tool is being tested; say only that in each pair one site was made by a person and the other with the help of artificial intelligence.
- Record every answer in `chave/respostas.csv`: participant, profile (`negocio`, `designer` or `outro`), pair number, the site they think AI made (`A` or `B`), the one they prefer (`A` or `B`). Commas or semicolons both work (spreadsheets in Portuguese save with semicolons).

### 5. Score

```
pnpm --filter @brotasites/jobs blind-test score [--answers <file.csv>]
```

Prints how often people spotted the generated site, with a one-sided binomial test against chance (50%), how often they preferred it, the same per profile and per pair, and whether the target was met:

- **At chance:** the spotting rate is not significantly above 50% (p ≥ 0.05). With 10 pairs and 15 participants (150 answers), spotting it 85 times (56.7%) or fewer passes; 86 times (57.3%) or more fails.
- **Preferred:** in at least half of the pairs, most participants preferred the generated site.

The pairs the generated site lost, and the ones where it was spotted most often, say where to invest first.
