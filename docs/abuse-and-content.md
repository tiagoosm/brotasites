# Abuse and content

One scam site on the sites' domain can make Google flag the whole domain. The policy is short and firm, and goes into the Terms of Use.

## Layers

1. **Prevention:** blocked categories (`categories.md`), automatic checks of text and subdomain, human review of every site at first, payment before publishing.
2. **Detection:** a "Denunciar este site" page and email in the footer of every site (a simple link), periodic checks of the subdomains and the domain against Google Safe Browsing (check the API's terms before relying on it), alerts on spikes (many new sites, AI cost).
3. **Response:** a per-site "suspended" switch in the Worker, with a neutral page. Scams and brand imitation: immediate suspension. Unclear cases: 48 hours for the client to explain. Suspension for breaking the Terms gives no refund (legal text). A record of who ordered the site, the published content and the decisions, to answer authorities.

## Grace period

End of the 12 months without renewal: a grace period (to define, suggestion 30 days), with a notice on the dashboard and a download link; then suspension. A cancelled subdomain stays in quarantine before it can be reused.

## Pending legal review

Terms of Use, Privacy Policy (LGPD), the 7-day guarantee and refunds.
