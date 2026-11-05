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
| `suspended` | Notice and reason | Admin |
| `grace` | Renewal notice and download | Client |

Rules: no loading screen; the dashboard polls the status (or uses Supabase realtime). No fake progress bar. Time estimates only when measured. On failure: one automatic retry, then `needs_attention` with an alert to the admin. Worst case, payment confirmed and publishing failed: automatic retry, immediate alert and a documented refund path.

## Payments (out of scope this round)

A `PaymentProvider` interface with a stub. When implemented (Asaas): publish only after a confirmed webhook, with idempotency; never trust the browser; never store card data. How the webhook is authenticated must be checked in the Asaas documentation.
