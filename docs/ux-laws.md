# UX laws (as leis de UX)

The single reference for how BrotaSites' interface is checked (E22). The owner's list has 20 items. The Law of Fitts appears twice: item 2 covers target size and item 8 covers distance. Here it is one law with two aspects, which gives 19 distinct laws.

Product decisions in `CLAUDE.md` ("Product rules") take precedence over any law below:

- no loading screen (generation is asynchronous);
- no live preview while answering;
- the client sees only the 3 directions and the finished site;
- 7 form steps;
- no notification e-mails;
- never invent numbers.

When a law asks for something those decisions rule out, record the conflict and do the closest thing that respects the decision. The first audit, with the measured numbers, is in [ux-audit.md](ux-audit.md).

## The laws and the rule for this project

| # | Law (pt-BR) | In one line | The rule here | How it is checked |
| --- | --- | --- | --- | --- |
| 1 | Hick (Lei de Hick) | Decision time grows with the number and complexity of choices | Few options per screen and one clear main action. Long lists get a search or groups. The header has at most 5 links and the profile menu at most 5 items | Automatic (header and menu counts); manual for the rest |
| 2, 8 | Fitts (Lei de Fitts: tamanho e distância) | Big, near targets are faster to hit | Every link, button and choice has its own 44×44px area. The main action is within thumb reach on phones (the form's sticky footer). "Voltar" and "Próximo" stay in fixed places. Destructive actions sit apart from the main one and ask for confirmation | Automatic (`targets.ts` on every screen, at 360 and 1280px); manual for placement |
| 3 | Jakob (Lei de Jakob) | People expect the site to work like the others they use | The logo goes home and the account is on the right. "Entrar ou cadastre-se". Labels sit above fields. E-mail and password use `autocomplete`, and the password has show/hide. Links are underlined or clearly links. The footer has the terms. A 404 page in pt-BR has a way back | Automatic (labels, 404); manual for the rest |
| 4 | Proximity (Lei da Proximidade) | Things near each other look related | A label sits right above its field and the error right under it, before any hint. A button sits next to what it acts on. Space between groups is larger than space inside them | Automatic (errors within 48px of their field) |
| 5 | Miller (Lei de Miller) | Working memory is small; group things into chunks | Nothing has to be remembered from one screen to the next. Long lists are grouped. Step 7 shows a review of the answers before approving | Manual |
| 6 | Doherty (Limiar de Doherty) | Interaction flows when the system answers in under ~400ms | Every click shows a change at once ("Enviando…", disabled, busy). Slow work (generating, publishing) runs in the background with its status on the dashboard; there is no loading screen | Automatic ("Próximo" turns busy in under 400ms with CPU ×4 and a slow network) |
| 7 | Von Restorff (Efeito Von Restorff) | What stands out is what is remembered | One highlighted (filled) action per block. The same action is never highlighted twice on a screen. Equal choices (the 3 directions) each get one in their own card | Automatic (no block with two filled buttons) |
| 9 | Serial position (Efeito de posição serial) | First and last items are remembered best | The most important goes first and last: the promise opens the home page and "Criar meu site" closes it. The header puts "Como funciona" first and the account last. The profile menu puts "Painel" first and "Sair" last | Manual |
| 10 | Peak-end (Regra do pico-fim) | Experiences are judged by their peak and their end | The 3 directions, the approval and "site no ar" are the peaks. Every flow ends clearly, on a positive note, saying what comes next | Manual |
| 11 | Zeigarnik (Efeito Zeigarnik) | Unfinished tasks stay on the mind | Drafts save as the client types. The dashboard says "Continue de onde parou: {passo}". Pending items stay listed until done | Automatic (the draft and its step on the dashboard) |
| 12 | Occam (Navalha de Occam) | The simplest explanation is usually the best | Remove elements, text, steps and options that serve no task. There is one way to do each thing | Manual |
| 13 | Tesler (Lei de Tesler) | Complexity is carried by someone: the person or the system | The system carries it: sensible defaults (sections by family), category search, phone and CEP masks, advanced options hidden | Manual |
| 14 | Postel (Lei de Postel) | Liberal in what you accept, conservative in what you send | Phone, WhatsApp, CEP and e-mail are accepted in common formats and normalized (digits, trimmed, lowercase). Validation rules stay as strict as security requires. Messages say how to fix the input | Unit tests of the schemas |
| 15 | Murphy (Lei de Murphy) | What can go wrong will | Confirm before destructive actions (delete the account, suspend a site). Keep drafts. Errors never lose data. 404 and error pages offer a way back | Automatic (404); manual for the rest |
| 16 | Similarity (Lei da Semelhança) | Things that look alike seem to belong together | The same style means the same function: one primary button style, one link style, one site card. Different styles only for different functions | Manual |
| 17 | Uniform connectedness (Conectividade uniforme) | Things joined by a line, border or background read as one | Group a unit with a card, a line or a background (a site with its status and actions; the form's stem). Do not join unrelated things | Manual |
| 18 | Parkinson (Lei de Parkinson) | Work expands to fill the time available | Short, bounded tasks: 7 short steps. Clear limits are stated (link expiry, included changes for 30 days). No time estimate until real sessions are measured | Manual |
| 19 | Cognitive load (Carga cognitiva) | Effort spent on the interface is taken from the task | Short, scannable text (E19), one subject per screen. The client's words, no jargon ("token", "slug", ".json"). Icons with text (familiar exceptions: show password, the bell, the menu). AA contrast | Manual; contrast and axe are automatic |
| 20 | Goal gradient (Efeito gradiente de meta) | Motivation grows near the goal | Show progress and what is left: "Passo N de 7", the stem, the dashboard's milestones, "falta só aprovar" | Automatic (progress on the form) |

The automatic checks live in `apps/platform/e2e/ux-laws.spec.ts` (with `targets.spec.ts` and `contrast.spec.ts`).

## Review checklist for each interface step

Answer each question for every screen the step changed, and list the laws touched (and any conflict) in the PR summary.

1. **Hick:** Is there one clear main action, and are the other choices few or grouped?
2. **Fitts:** Does every target have its own 44px area? Is the main action within thumb reach? Is anything destructive apart and confirmed?
3. **Jakob:** Does it work the way people already expect (labels, autocomplete, links, logo, back)?
4. **Proximity:** Is each label above its field, each error right under it, and each button next to what it acts on?
5. **Miller:** Is anything asked that the person must remember from another screen?
6. **Doherty:** Does every click show a change in under 400ms, even on a slow phone?
7. **Von Restorff:** Is there one highlight per block, and is the same action never highlighted twice?
8. **Serial position:** Is the most important thing first and last?
9. **Peak-end:** Does the flow end clearly, on a positive note, saying what comes next?
10. **Zeigarnik:** Is unfinished work saved and shown, with where it stopped?
11. **Occam:** Can any element, text or step be removed?
12. **Tesler:** Is the system carrying the complexity (defaults, masks, search)?
13. **Postel:** Are common input formats accepted and normalized, with messages that say how to fix them?
14. **Murphy:** What happens offline, on error, on a double click, or after a mistake? Can it be undone or confirmed?
15. **Similarity:** Does the same style mean the same function everywhere?
16. **Uniform connectedness:** Are units grouped by a card, line or background, and unrelated things apart?
17. **Parkinson:** Are limits and deadlines stated, with nothing left open-ended?
18. **Cognitive load:** Is the text short, in the client's words, with no jargon and icons with text?
19. **Goal gradient:** Can the person see how far along they are and what is left?
