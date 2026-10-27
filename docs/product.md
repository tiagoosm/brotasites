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
| `customDomain` | 97 | Connecting a custom domain |
| `guaranteeDays` | 7 | Money-back guarantee (legal text PENDING REVIEW) |
| `legalReviewed` | `false` | Until true, guarantee and refund texts carry a "pendente de revisão jurídica" mark |

Every value shown on a page, in the FAQ or at checkout comes from this file. Never write price comparisons with competitors.

## What is included

Creating, editing and seeing the directions and the finished site: free. Charged only to publish. Included: 12 months of hosting, 30 days of changes through the dashboard, download of the static site. After 12 months, keeping it online costs R$ 99 per year (optional); a client who does not renew can download the site before it goes offline (grace period defined in `docs/abuse-and-content.md`). Custom domain: + R$ 97, and the client pays the registrar directly for the domain.

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
