# UX audit against the 20 laws (E22)

Audited on 2026-11-03 against [ux-laws.md](ux-laws.md). Every screen of the platform was opened with Playwright at 360, 768 and 1280px, signed out, signed in and as the team, against the fake Supabase of the e2e tests. Screenshots were kept out of the repository (scratchpad); this report keeps only the numbers and the evidence.

## Summary

**What is good.** The structure already follows most laws:

- **Hick and serial position:** 4 header links. One question per form step. The 118 categories go through a search. The promise opens the home page and "Criar meu site" closes it.
- **Zeigarnik and goal gradient:** autosave, "Continue de onde parou: {passo}" on the dashboard, and "Passo N de 7" with the stem on the form.
- **Jakob:**
  - the logo goes home and the account sits on the right;
  - e-mail and password fields carry `autocomplete`, and the password has show/hide;
  - labels sit above their fields.
- **Postel:**
  - e-mails are trimmed and lowercased;
  - WhatsApp and phone are accepted with or without punctuation and stored as digits;
  - the CEP is masked.
- **Murphy:** account deletion asks for the e-mail again.
- **Cognitive load:** the copy is short (E19), and no visible client text uses jargon except one (".json", below).

**The 10 largest failures found** (severity, then status):

| # | Law | Finding (measured) | Severity | Status |
| --- | --- | --- | --- | --- |
| 1 | Doherty | Form "Próximo": no visible change for **1,650 ms** after the click (CPU ×4, 1.5 s network); the next step renders on the server and nothing said so | High | Fixed: the button turns busy (spinner, `aria-busy`) at once; test asserts < 400 ms |
| 2 | Fitts | Site page (live and ready to approve) **wider than a 360px screen**: "Montar o site de novo com as mudanças" did not wrap, so the whole column was 369px | High | Fixed: the button wraps |
| 3 | Murphy, Jakob | No 404 or error page: unknown addresses showed Next.js's default **in English**, with no logo and **0 links** | High | Fixed: `app/not-found.tsx` (pt-BR, logo, "Ir para o início", "Ir para o painel") and `app/error.tsx` ("Tentar de novo") |
| 4 | Murphy, Fitts | Team area: "Suspender" (takes a client site off the air) acted on **one click, 56px from "Aprovar"** at 1280px | Medium | Fixed: moved to the far end of the row and asks "Confirmar suspensão" |
| 5 | Von Restorff, Occam | Dashboard: the same action highlighted twice (pending list and the site card): **4 primary buttons at 360px, 5 at 1280px** | Medium | Fixed: the card's button is secondary; the pending list holds the highlight |
| 6 | Fitts | Sign-in: "Entrar com um link no e-mail" and "Esqueci a senha" **23px tall, 4px apart** | Medium | Fixed: 24px apart, each with its 44px area |
| 7 | Fitts | Sign-up and Conta: the Termos and Privacidade links **inside the checkbox sentence, 20px tall** | Medium | Fixed: the sentence stays, the two links sit on their own line, 44px each |
| 8 | Fitts | Form targets under 44px: section switches **48×28**, "Mudar" in the review **41×20**, "Como tirar boas fotos" **23px**, "página do site" **18px** | Medium | Fixed |
| 9 | Proximity | A field's error came **after its hint**: on phones the password error sat more than 48px below the field (rule and meter in between) | Medium | Fixed: error first, right under the field, then the hint |
| 10 | Cognitive load | Conta: "Baixar meus dados **(.json)**" | Low | Fixed: "Baixar meus dados" |

Also fixed:

- At 360px, the dashboard's notices bell sat too close to "Perfil e segurança".
- The payment page's "Voltar" was 24px tall.
- A live site's address link was 26px tall.
- The link row in "Pedir ajustes" wrapped with 4px between lines.

**Left for later**, with the reason:

- **Parkinson:** a time estimate ("leva uns N minutos"). There is no measured figure, and the project never invents numbers. Measure real sessions first.
- **Tesler:** filling the city from the CEP. It needs a CEP lookup service, which is a provider choice for the owner (`owner-steps.md`).
- **Goal gradient:** a journey progress on each site's page ("faltam 2 etapas para publicar"). It is low risk but new UI, so it is a recommendation.
- **Peak-end:** "Seu site está no ar." is plain. A warmer end (the address, "compartilhe com seus clientes") is a copy proposal for the owner.
- **Von Restorff vs Jakob on Conta:** one primary button per section (4 sections with forms). This is the familiar settings pattern, so it is kept as a recorded conflict.
- **Cognitive load vs Jakob:** the notices bell is icon-only, a familiar pattern with a label and an unread count for screen readers. Kept.
- **Doherty:** the form's "Voltar" link gives no feedback while the previous step loads. Low; `useLinkStatus` can add it later.
- **Murphy:** undo for destructive actions. That is a feature, so it was not built; confirmations cover it for now.
- **Legal pages:** paragraphs of up to 59 words. Their wording waits for the lawyer.

## Conflicts with the owner's decisions (the decisions stand)

| Law | What it would ask | Decision that prevails | What was done instead |
| --- | --- | --- | --- |
| Doherty | Show the slow work happening | No loading screen; generation is asynchronous | Immediate feedback on every click; the status and the notices on the dashboard show progress |
| Peak-end, goal gradient | Show the site taking shape while answering | No live preview while answering | The peak is the page with the 3 directions, then the finished site; "Passo N de 7" shows the way |
| Hick | Fewer steps | The form has 7 steps | One question per step; the review on step 7 shows everything at once (Miller) |
| Parkinson | A time estimate | Never invent numbers | No estimate until real sessions are measured |
| Peak-end | A celebration e-mail when the site goes live | No notification e-mails this round | In-site notice and status on the dashboard |

## Laws that contradict each other on the same screen

- **Von Restorff vs serial position (home page):** "Criar meu site" appears 3 times, at the start, after the questions and at the end. Each section has a single highlight and all three do the same thing, so this is kept.
- **Von Restorff vs Jakob (Conta):** each section that saves something has its own filled button, as settings pages usually do. This is kept.
- **Hick vs Fitts (header):** 4 links plus the account on desktop. On phones the links move into a menu so the targets can stay at 44px and the bar stays short.
- **Hick vs equal choices (directions):** 3 filled "Escolher esta" buttons, one per card. These are three equal options, by design, so each card counts as its own block.

## Matrix: screen × law

✓ meets · ◐ partly · ✗ does not meet · – does not apply. The cells show what was found before the fixes; an arrow marks what this step fixed.

| Law | Home | Help, terms, privacy | Sign-in, sign-up, password | Dashboard | Account | Form (7 steps) | Directions | Site page (ready, live) | Test payment | Team area | 404, error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Hick | ✓ | ✓ | ✓ | ◐→✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗→✓ |
| 2/8 Fitts | ✓ | ✓ | ✗→✓ | ◐→✓ | ✗→✓ | ◐→✓ | ✓ | ✗→✓ | ◐→✓ | ✗→✓ | – |
| 3 Jakob | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗→✓ |
| 4 Proximity | ✓ | ✓ | ◐→✓ | ✓ | ◐→✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| 5 Miller | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | – |
| 6 Doherty | – | – | ✓ | ✓ | ✓ | ✗→✓ | ✓ | ✓ | ✓ | ✓ | – |
| 7 Von Restorff | ✓ | ✓ | ✓ | ✗→✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ◐→✓ | ✗→✓ |
| 9 Serial position | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | – |
| 10 Peak-end | ✓ | – | ✓ | ✓ | – | ✓ | ✓ | ◐ | ✓ | – | – |
| 11 Zeigarnik | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – |
| 12 Occam | ✓ | ✓ | ✓ | ◐→✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 13 Tesler | – | – | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | – | ✓ | – |
| 14 Postel | – | – | ✓ | – | ✓ | ✓ | – | – | – | – | – |
| 15 Murphy | – | – | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗→✓ | ✗→✓ |
| 16 Similarity | ✓ | ✓ | ✓ | ◐→✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐→✓ | ✓ |
| 17 Uniform connectedness | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | – | ✓ | – |
| 18 Parkinson | ◐ | – | ✓ | ✓ | – | ✓ | ✓ | ✓ | ✓ | – | – |
| 19 Cognitive load | ✓ | ◐ | ✓ | ✓ | ◐→✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ✗→✓ |
| 20 Goal gradient | – | – | – | ✓ | – | ✓ | ✓ | ◐ | – | – | – |

## Evidence

Numbers come from a Playwright probe run on every screen at 360, 768 and 1280px with reduced motion. The probe counted:

- header links and filled ("primary") buttons, overall and per block;
- 44px tap areas (the project's existing check) and the gaps between neighbouring targets;
- fields without a visible label, and `autocomplete`;
- icon-only controls;
- jargon words in the visible text;
- paragraph length.

**Hick, Von Restorff:**

- Header: 4 links on every page (`components/site/nav.ts`).
- Profile menu: 4 items, or 5 with "Área da equipe", plus "Sair".
- Home page: 3 primary buttons, one per section (hero, after the questions, final call).
- Dashboard before the fix: 4 primaries at 360px, 5 at 1280px (`app/(app)/painel/page.tsx`, the card's button was filled whenever it was the client's turn).
- Conta: 4 primaries, one per section that saves.
- Directions: 3, one per card.

**Fitts (before):**

| Screen | Target | Size or overlap |
| --- | --- | --- |
| Entrar | "Entrar com um link no e-mail" | 195×23, its area overlapped by "Esqueci a senha" 4px below |
| Cadastro | "Termos de uso" | 99×20 inside the label |
| Cadastro | "Política de Privacidade" | 153×20 inside the label |
| Conta | Same two links | Same as Cadastro |
| Passo 3 | Section switch | 48×28 (`sections-step.tsx`) |
| Passo 4 | Photo tips summary | 23px tall (`content-step.tsx`) |
| Passo 7 | "Mudar" | 41×20 (`address-step.tsx`) |
| Passo 7 | "página do site" | 88×18 (`address-step.tsx`) |
| Site page | Link row | Lines 4px apart (`site-dashboard.tsx`) |
| Site page | Live address | 26px tall (`site-dashboard.tsx`) |
| Pagamento | "Voltar" | 24px tall (`components/shared/page-state.tsx`) |
| Painel at 360px | Bell | Bell's area overlapped by "Perfil e segurança" |

**Sideways scroll:** at 360px, `/meus-sites/{id}` in "awaiting approval" and "live" measured 369px wide. The cause is the outline button's `whitespace-nowrap`.

**Doherty:** time from the click to the first visible change, with CPU ×4 and responses delayed by 1.5 s:

| Action | Time |
| --- | --- |
| Sign-in "Entrar" | 26 ms ("Enviando…") |
| Form "Próximo" | 1,650 ms (nothing until the next page) |
| "Ver as 3 direções" | 9 ms ("Enviando…") |

**Labels and errors:**

- Every field on every screen has a visible label: 0 unlabeled fields found.
- E-mail fields use `autocomplete="email"`. Passwords use `current-password` on sign-in and `new-password` on sign-up and Conta.
- The new e-mail field on Conta has `autocomplete="off"` on purpose.
- Errors are tied to their fields with `aria-describedby`; before the fix they came after the hint (`components/account/field.tsx`, `password-field.tsx`).

**Murphy:**

- There was no `not-found.tsx` and no `error.tsx` in `apps/platform/src/app`.
- Account deletion asks for the e-mail and recent sign-in (`conta/account-page.tsx`).
- The form saves to the account at each change and falls back to the device ("Salvo neste aparelho, mas não na sua conta").

**Cognitive load:**

- The only jargon in client screens was ".json" (Conta). "HTTP" appears in the privacy policy (legal text, left as is). "(.zip)" on the download button was kept: it is the file the client receives.
- Longest client paragraphs: Conta 27 words (account deletion); the rest are at most 20. Legal pages run up to 59 words.

**Goal gradient:** "Passo N de 7" appears on every form step, as the stem rail from 1280px and in the header on smaller screens.

## Platform docs that contradicted the code

`docs/platform-design.md` still described the live preview (the "Table" token, "Layout" with a preview column and "Ver prévia"). The live preview was removed in E10 (owner decision of 2026-10-27). The document was updated to match the code; no behavior changed.

## Generated client sites (sample: the 10 sites of the blind-test kit)

Measured at 360px, served as built (`apps/jobs/kit/generated`). No catalog variant was changed in this step.

| Law | Finding | Proposal |
| --- | --- | --- |
| Hick | 8 to 10 actions per page, all of one or two kinds (WhatsApp; "Como chegar"; phone or e-mail where given) | Keep |
| Fitts | Floating WhatsApp button 56×56, fixed; inline buttons 44 to 76px tall; 0 targets under 44px; no sideways scroll | Keep |
| Jakob | Business-page pattern: name and contact at the top, services, about, hours, address with "Como chegar", contact at the end, skip link | Keep |
| Serial position, Von Restorff | The main action is at the top (header, hero) and at the end (final call) | On the first screen, the header, hero and floating buttons show the same WhatsApp action 3 times. Propose showing the floating button only after the hero's button leaves the screen (one highlight at a time). This goes through the catalog cycle (E6/E11). |
| Cognitive load, Occam | 1 h1 per site; longest paragraph 14 to 31 words (31 in one "Sobre" text) | Propose a 25-word cap per paragraph in the copy playbook for the about text, checked by the reviewer |
| Goal gradient, Parkinson | Not applicable to a business page | – |

These two proposals are recorded for the next catalog round; neither is built here.
