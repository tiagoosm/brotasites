# Legal compliance (E43)

What the platform does to follow Brazilian consumer, internet and data law, where each rule comes from, and what is still missing. Research of 2026-11-14. The official sites (planalto.gov.br, camara.leg.br) did not open from the development environment, so the texts were checked through secondary sources quoting them (links below); a lawyer must still review everything (`pricing.legalReviewed` stays `false` and the pages keep the "pendente de revisão jurídica" mark).

## Rules applied

| Rule | Source | What the platform does |
|---|---|---|
| Withdrawal within 7 days of a contract made outside a shop, without a reason; what was paid comes back at once, updated | CDC (Lei 8.078/1990) art. 49 and its parágrafo único | "Desistir da compra" on the site's page for 7 days after the payment is confirmed (`pricing.guaranteeDays`, `private.withdrawal_days()`); full refund of the amount paid, through the same payment method |
| The seller states clearly how to withdraw; the consumer may withdraw through the same tool used to buy; receipt confirmed at once; the bank or card company is told so the charge is not billed or is refunded | Decreto 7.962/2013 art. 5, caput and §§ 1, 3 and 4; art. 7 (sanctions of CDC art. 56) | The option and its deadline are on the site's page, the payment page, the price section, the FAQ and the Terms; the withdrawal is done in Meus sites (where the client paid) or by email; the page confirms receipt at once with the date and time and the client gets a notice; the team is notified and refunds at the payment provider, then records it ("Desistência" on the site's page, "Desistências a devolver" on the Sites list) |
| Clear information before contracting | CDC art. 6, III | The payment page and the delete steps say that after the 7 days there is no refund, before the client confirms |
| No clause that removes rights or the option of a refund | CDC art. 51, I and II | The Terms keep "Nada nestes termos limita os direitos garantidos pelo Código de Defesa do Consumidor"; the no-refund rule applies only after the legal withdrawal period |
| Personal data deleted when the purpose ends, kept only for a legal obligation | LGPD (Lei 13.709/2018) art. 16, I | A deleted site loses its content, files and history; charges keep who paid (`retained_customer`) for the tax period; the takedown audit keeps no more than the address, who acted, when and why |
| Period to claim for damages: 5 years | CDC art. 27 | The takedown audit (`site_takedowns`) and refund requests are kept 5 years; the daily routine removes audit rows older than that (`server_purge_expired_records`) |
| Tax records: 5 years | CTN art. 195, parágrafo único (with art. 173) | Charges and refunds are kept 5 years with the payer's data (already the rule since E15) |

## Decisions (owner, 2026-11-14)

- Refund policy: full refund within the 7-day withdrawal period, counted from the payment confirmation; after it, deleting a site or stopping using it gives no refund, because the site was created, published and delivered. Said before paying and before deleting. A proportional refund for a service already used is debated in doctrine; the platform chose the full refund, the safer option for the consumer.
- 7 days of waiting before a deletion and 30 days of rest for the address: kept (they protect the client from mistakes and from someone posing as the business).
- Reporting a site (E42 part 5): not built. The team removes sites that break the rules (Terms, "Tirar o site do ar e excluir").

## Gaps (to do before charging real clients)

1. **Access logs for 6 months (Marco Civil da Internet, Lei 12.965/2014, art. 15).** An application provider run as a company for profit must keep IP, date and time of access for 6 months. The platform does not store them yet (Vercel's own log retention depends on the plan). Needs a decision on where to keep them (a table with RLS and a 6-month purge is the simplest) and then a line in the privacy policy. The policy does not claim it today.
2. **Seller identification (Decreto 7.962/2013 art. 2).** Name/company name, CNPJ or CPF, physical and electronic address must be easy to find on the platform. `RESPONSIBLE_PARTY` in `apps/platform/src/content/contact.ts` is still empty ("a definir").
3. **Refunds at the payment provider.** Payments are a stub; with Asaas, the refund (card chargeback or Pix return) is still done by the team in the provider's panel. Automating it is part of the Asaas step.
4. **Lawyer review** of the Terms and the Privacy Policy, then `pricing.legalReviewed = true` and a new `TERMS_VERSION`.

## Sources (secondary, quoting the laws)

- CDC art. 49: [modeloinicial.com.br](https://modeloinicial.com.br/peticao/11199898/contestacao-direito-arrependimento), [idec.org.br](https://idec.org.br/node/21404), [jus.com.br](https://jus.com.br/artigos/30766/consideracoes-sobre-o-direito-ao-arrependimento-no-direito-do-consumidor)
- Decreto 7.962/2013: [camara.leg.br](https://www2.camara.leg.br/legin/fed/decret/2013/decreto-7962-15-marco-2013-775557-publicacaooriginal-139266-pe.html), [senado.leg.br](https://legis.senado.leg.br/norma/413161/publicacao/15762397), [procon GO](https://goias.gov.br/procon/decreto-no-7-962-de-15-de-marco-de-2013-dispoe-sobre-a-contratacao-no-comercio-eletronico/)
- Digital services and withdrawal: [melhoreshospedagem.com](https://www.melhoreshospedagem.com/direito-de-arrependimento/), [galiciaeducacao.com.br](https://www.galiciaeducacao.com.br/blog/arrependimento-em-servicos-limites-e-aplicacao-do-art-49/)
- Marco Civil art. 15: [modeloinicial.com.br](https://modeloinicial.com.br/lei/27460/marco-civil-internet/art-15), [legale.com.br](https://legale.com.br/blog/prazo-de-guarda-de-dados-no-marco-civil-regras-e-conflitos-juridicos/)
- LGPD art. 16: [aurum.com.br](https://www.aurum.com.br/blog/lgpd-comentada/art-15-a-16-lgpd/), [juruadocs.com](https://www.juruadocs.com/legislacao/art/lei_00137092018-16)
- Tax records: [econeteditora](https://blog.econeteditora.com.br/padronizado-prazo-de-guarda/), [jus.com.br](https://jus.com.br/artigos/10687/decadencia-e-conservacao-de-documentos-fiscais)
