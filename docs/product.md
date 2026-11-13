# Product, pricing and status

## Pricing

Every value lives in `apps/platform/src/config/pricing.ts`:

| Field | Value | Meaning |
| --- | --- | --- |
| `publish` | 297 | One-time payment to publish a site, in BRL |
| `launchPrice` | `null` | Optional launch price (undecided between 197 and 297) |
| `hostingMonths` | 12 | Hosting included |
| `adjustmentsDays` | 30 | Changes through the dashboard included after publishing |
| `renewalPerYear` | 99 | Optional yearly renewal |
| `customDomainIncluded` | `true` | Connecting the client's own domain: included and optional, no price (decision of 2026-11-04) |
| `guaranteeDays` | 7 | Money-back guarantee (legal text PENDING REVIEW) |
| `legalReviewed` | `false` | Until true, guarantee and refund texts carry a "pendente de revisão jurídica" mark |

Every value shown on a page, in the FAQ or at checkout comes from this file. Never write price comparisons with competitors.

## What is included

Creating, editing and seeing the directions and the finished site: free. Charged only to publish. Included: 12 months of hosting, 30 days of changes through the dashboard, download of the static site. After 12 months, keeping it online costs R$ 99 per year (optional); a client who does not renew can download the site before it goes offline (grace period defined in `docs/abuse-and-content.md`). The client's own domain: included and optional (decision of 2026-11-04). The client registers, pays and renews the domain at the registrar; BrotaSites never sells nor registers domains; without one, the site stays at `seunegocio.<BASE_DOMAIN>`.

## Limits (E24)

All values live in `apps/platform/src/config/limits.ts`; the database enforces them.

- **Directions:** 3 free rounds per site (the first and 2 redos). After that, 1 more round per hour. The count never resets. Choosing one of the 3 is never blocked. The site page says "Você usou 1 de 2 refazeres grátis" and, while waiting, "Próxima rodada disponível às 15h40".
- **Sites in progress:** 1 unpaid site in progress per account. A paid site frees the slot. The client can finish it, or discard it (with confirmation) from the dashboard card or the site's page, in any unpaid status in progress, drafts included and also while we work on it (the round in progress is lost). Accounts that already had more keep them. The team can grant an extra slot, with a reason.
- **Idle sites:** an unpaid site waiting on the client (draft, choosing a direction, approving, needs attention) with no action for 30 days is deleted. The dashboard warns 7 days and 1 day before, and each card says until when it is kept. Any change renews the deadline. Sites that wait on us (generating, building, in review) and paid sites are never deleted. The team can postpone a deletion.

## Client's own domain (E25)

Included and optional. On the page of a published site: *Usar o seu próprio domínio*. States the client sees: *Aguardando configuração*, *Verificando*, *Ativo*, *Com problema* (with what to do), and *Removido*. Only a paid site can connect one; before that, Publicar only notes the domain the client means to use. The BrotaSites address keeps working; the client chooses the main address and the other redirects to it. Details in `docs/hosting.md`, "Client domains (E25)".

## Site status

| Status | What the client sees | Who acts |
| --- | --- | --- |
| `draft` | Unfinished form | Client |
| `generating_directions` | "Criando as 3 direções" | System |
| `awaiting_direction_choice` | 3 cards to choose from | Client |
| `building` | "Montando seu site" | System |
| `in_review` | "Dando uma última olhada" | Reviewer + admin |
| `awaiting_approval` | Finished site: request changes, or approve and pay | Client |
| `publishing` | "Colocando no ar" | System |
| `live` | Link to the site | |
| `needs_attention` | A clear message about what is missing | Client or admin |
| `suspended` | Notice and reason; cannot undo it | Admin (disciplinary: reports, terms) |
| `grace` | Renewal notice and download | Client |
| `offline` (E42) | "Fora do ar (por você) · Recolocar no ar", or the team's reason when it chose to show it; with a scheduled deletion, "Exclusão em N dias · Cancelar exclusão" | Client (their own take-offline and deletion) or admin |

**Taking offline and deleting (E42).** Two different things:

- **Tirar do ar** (reversible): the site stops answering (KV `offline`, the Worker's "Site fora do ar", 410, also on the client's own domain); nothing is deleted. The client does it alone and undoes it alone; the team may do it with a reason (the client cannot undo the team's). From `live` or `grace` only; `grace` comes back as `grace`.
- **Excluir** (final): scheduled for `deletionWaitDays` (7) with the site offline meanwhile, cancellable until then (the client cancels only their own). Then the content, directions, reports, events, files, the R2 copy, the preview and the client's domain go; the charges (with who paid, as account deletion keeps them), the terms acceptances (they belong to the account) and the audit record (`site_takedowns`: site id, address, who, when, reason, note) stay. The address rests 30 days (`subdomain_holds`): nobody else may take it; its owner may. The team may also delete now (typing the address; never with a job or a charge on the way).
- `suspended` stays the team's disciplinary measure; `offline` is the neutral one. An unpaid site is still discarded on its page (E24), not deleted this way.
- No team approval for the client's own requests: the team is told (a notice to every admin) and sees the scheduled deletions on its panel (the *Sites* tab, `/admin/sites`, with the filters *No ar*, *Fora do ar* and *Exclusão agendada* and a counter; on a site's page, *Retirada do ar* with the history from `site_takedowns`). Deleting a paid site gives no slot or credit back (the slot rule counts unpaid sites in progress only).

Rules: no loading screen; the dashboard polls the status (or uses Supabase realtime). No fake progress bar. Time estimates only when measured. On failure: one automatic retry, then `needs_attention` with an alert to the admin. Worst case, payment confirmed and publishing failed: automatic retry, immediate alert and a documented refund path.

## Payments (out of scope this round)

A `PaymentProvider` interface with a stub. When implemented (Asaas): publish only after a confirmed webhook, with idempotency; never trust the browser; never store card data. How the webhook is authenticated must be checked in the Asaas documentation.
