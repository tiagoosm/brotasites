# Platform copy

Copy for the BrotaSites platform: the public site and the form. User-facing text is pt-BR; notes are in English. Written on 2026-10-20 with the slogan chosen by the project owner.

## Voice

- **Who reads it:** people who run a business and want a site without learning technology. The copy never names the size or type of business ("pequeno negócio", "de bairro"): it talks to *seu negócio*, so a bakery, a clinic and a studio all feel addressed.
- **Tone:** warm, plain and confident. Short sentences, everyday verbs, sentence case, no exclamation marks, no em dashes.
- **Promise only what the product does.** No invented numbers, prices, testimonials or rankings. Items that depend on open decisions are marked `[pendente]`.
- **The slogan is the structure.** The form really has seven steps, so each step's title is one of the seven questions.

## Slogan

**Sete perguntas e seu site pronto.**

Alternatives kept for A/B tests:

- *Sete perguntas. Seu site pronto.* Two beats, more poster-like.
- *Responda sete perguntas e publique seu site.* Puts the action first.

## Public site

Built on 2026-10-24 (design: [superpowers/specs/2026-10-24-main-site-design.md](superpowers/specs/2026-10-24-main-site-design.md)). The text lives in the code: `apps/platform/src/app/(site)/page.tsx` and `apps/platform/src/content/` (`faq.ts`, `stem.ts`, `legal.ts`). This section records the decisions behind it.

### Price

- Model (2026-10-25): one-time payment per site, no monthly plan. All values live in `apps/platform/src/config/pricing.ts` (publish R$ 297, optional `launchPrice` shown with the regular price crossed out, 12 months of hosting, 30 days of dashboard changes, optional renewal R$ 99/year, custom domain + R$ 97, 7-day guarantee).
- Section *Quanto custa*: *Criar, editar e ver a prévia é grátis. Você só paga se quiser colocar o site no ar.* The guarantee and refund texts show *pendente de revisão jurídica* until `legalReviewed` is true.
- No comparisons with freelancers or competitors.

### Home page

- **Header:** Como funciona · Ajuda · Entrar · **Criar meu site** (not on the home page, which has its own).
- **Main button:** three on the home page: *Continuar com este site* in the hero demo, *Criar meu site* after the seven questions and in the final call.
- **Example page (/exemplo):** the Padaria do Zé example built by the real generator, under a slim bar: *Voltar* · *Site de exemplo: a Padaria do Zé é fictícia, mas o site foi feito pelo BrotaSites.* · *Criar o meu*.
- **Hero:** *Sete perguntas e seu site pronto.* / *Conte o que você faz, escolha cores e fotos e veja o site tomar forma enquanto responde. Sem código.* / **Ver um site de exemplo** (to /exemplo) · a smaller *Ver como funciona* text link. Beside it, the *Experimente aqui* demo: a name field and six business types update a miniature of the site (fixed example titles per type, labeled *Texto de exemplo*; *Nada é salvo aqui*), and **Continuar com este site** carries name and type to the first question. Behind it, a soft morning light from the top right corner; in the side margins of wide screens, a faint vine follows the mouse.
- **Como funciona:** *Sete perguntas, uma de cada vez.* / *Cada resposta aparece na prévia na hora. Você pode voltar e mudar o que quiser antes de publicar.* Then the seven questions, exactly as in the form (`formSteps`), each with one sentence from `content/stem.ts`, ending with *Pronto. Seu site no ar.*
- **O que todo site tem:** WhatsApp a um toque; Aberto ou fechado, na hora; Endereço e mapa; Feito para o celular; Pronto para o Google. All exist in the `classico` template.
- **Quanto custa:** see Price above.
- **Dúvidas:** the four questions marked `main` in `content/faq.ts`, and *Ver todas as dúvidas*.
- **Final call:** *Seu site está a sete perguntas de distância.* / *Comece agora e veja a prévia na hora. Você só publica quando gostar do resultado.*

### Help, terms and privacy

- Help answers say only what the product does today. Open decisions are stated as such: custom domain *ainda não está disponível*; changes after publishing *ainda está sendo definida*; account deletion is done on request.
- Terms and privacy are first drafts in plain language, marked *Versão inicial, em revisão jurídica*. They need a lawyer's review before BrotaSites accepts clients.
- Responsible party and contact e-mail: pending (`src/content/contact.ts`). Pages say *a definir*; nothing shows an address until it exists.

### Meta

- **Title:** BrotaSites · Sete perguntas e seu site pronto
- **Description:** Responda sete perguntas e veja o site do seu negócio ficar pronto enquanto escreve. Com WhatsApp, mapa e horário de funcionamento. Sem código.
- **Share image:** `src/app/opengraph-image.png`, made by `scripts/og-image.mjs`.

## The seven questions (form)

| Step (rail) | Title (question) | Description |
| --- | --- | --- |
| Seu negócio | Qual é o seu negócio? | Três respostas e o seu site já começa a aparecer na prévia. |
| Modelo | Qual estilo combina com você? | Todos os modelos se ajustam ao celular. Dá para trocar quando quiser. |
| Cores e fontes | Que cores e letras são a sua cara? | Comece por uma paleta pronta ou escolha as suas cores. A gente avisa se algum texto ficar difícil de ler. |
| Seções | O que não pode faltar no seu site? | Ligue, desligue e mude a ordem das partes do site. |
| Conteúdo | O que você quer contar? | Escreva do jeito que você explicaria para um cliente. |
| Contato e fotos | Como os clientes chegam até você? | WhatsApp, endereço, horários e fotos aparecem no site exatamente como você informar. |
| Endereço e revisão | Onde o seu site vai morar? | Escolha o endereço e confira tudo antes de publicar. |

### Microcopy

- **Step label:** `Pergunta N de 7` everywhere (rail, header, step), never "Etapa".
- **Next button:** `Próximo: <etapa>` (says where it goes). Last step: `Revisar e publicar`.
- **Back:** Voltar
- **Business type help:** Com isso sugerimos modelo, cores e seções. Você pode mudar tudo depois.
- **Errors** (say what to do, never apologize):
  - Escreva o nome do negócio, com pelo menos 2 letras.
  - Escolha um tipo da lista ou escreva qual é.
  - Escreva a cidade onde o negócio fica.
  - Use até 80 caracteres. (limits vary by field)
- **Autosave:** Salvando… / Rascunho salvo neste aparelho / Não foi possível salvar neste aparelho
- **Loading the draft:** Abrindo o seu rascunho…
- **Preview:** Prévia ao vivo · Ver prévia · Fechar prévia
