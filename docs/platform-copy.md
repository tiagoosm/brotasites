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
- Section *Quanto custa*: *Criar, editar, ver as direções e o site pronto é grátis. Você só paga se quiser colocar o site no ar.* The guarantee and refund texts show *pendente de revisão jurídica* until `legalReviewed` is true.
- No comparisons with freelancers or competitors.

### Home page

- **Header:** Como funciona · Ajuda · Entrar · **Criar meu site** (not on the home page, which has its own).
- **Main button:** three on the home page: *Continuar com este site* in the hero demo, *Criar meu site* after the seven questions and in the final call.
- **Example page (/exemplo):** the Padaria do Zé example built by the real generator, under a slim bar: *Voltar* · *Site de exemplo: a Padaria do Zé é fictícia, mas o site foi feito pelo BrotaSites.* · *Criar o meu*.
- **Hero:** *Sete perguntas e seu site pronto.* / *Conte o que você faz e escolha uma de 3 direções para o visual. A gente monta o site e você só aprova. Sem código.* / **Ver um site de exemplo** (to /exemplo) · a smaller *Ver como funciona* text link. Beside it, the *Experimente aqui* demo: a name field and six business types update a miniature of the site (fixed example titles per type, labeled *Texto de exemplo*; *Nada é salvo aqui*), and **Continuar com este site** carries name and type to the first question (after signing in). The miniature is a sample, not a preview of the form: its status line says *Amostra*. Behind it, a soft morning light from the top right corner; in the side margins of wide screens, a faint vine follows the mouse.
- **Como funciona:** *Sete perguntas, uma de cada vez.* / *Suas respostas ficam salvas na sua conta. Pode fechar a página e voltar depois: o andamento aparece no seu painel.* Then the seven questions, exactly as in the form (`formSteps12`), each with one sentence from `content/stem.ts` and a still picture, ending with *Pronto. Seu site no ar.*
- **O que todo site tem:** WhatsApp a um toque; Aberto ou fechado, na hora; Endereço e mapa; Feito para o celular; Pronto para o Google. All exist in the `classico` template.
- **Quanto custa:** see Price above.
- **Dúvidas:** the four questions marked `main` in `content/faq.ts`, and *Ver todas as dúvidas*.
- **Final call:** *Seu site está a sete perguntas de distância.* / *Comece agora. Criar e ver o site pronto é grátis; você só paga para colocar no ar.*

### Help, terms and privacy

- Help answers say only what the product does today. Open decisions are stated as such: custom domain *ainda não está disponível*; changes after publishing *ainda está sendo definida*; account deletion is done on request.
- Terms and privacy are first drafts in plain language, marked *Versão inicial, em revisão jurídica*. They need a lawyer's review before BrotaSites accepts clients.
- Responsible party and contact e-mail: pending (`src/content/contact.ts`). Pages say *a definir*; nothing shows an address until it exists.

### Meta

- **Title:** BrotaSites · Sete perguntas e seu site pronto
- **Description:** Responda sete perguntas, escolha uma de 3 direções para o visual e receba o site do seu negócio pronto. Com WhatsApp, horários e botão Como chegar. Sem código.
- **Share image:** `src/app/opengraph-image.png`, made by `scripts/og-image.mjs`.

## The seven questions (form)

Since E10 the form follows `docs/form-flow.md`. Titles, questions and descriptions live in `formSteps12` (`packages/schema/src/v1.2/form.ts`).

| Step (rail) | Title (question) | Description |
| --- | --- | --- |
| Seu negócio | Qual é o seu negócio? | O básico primeiro. Quanto mais detalhe de verdade, mais o site fica com a sua cara. |
| Marca e sensação | Como você quer que o seu negócio pareça? | Logo e cores são opcionais. Sem logo, a gente cria um monograma com o seu nome. |
| Seções | O que o seu site vai mostrar? | Já deixamos ligadas as seções que mais funcionam para o seu tipo de negócio. |
| Conteúdo | O que você oferece? | Serviços, diferenciais, perguntas e fotos. Escreva do seu jeito: a gente arruma o texto. |
| Contato | Como os clientes falam com você? | Pelo menos um canal: WhatsApp, telefone ou e-mail. |
| Direção | Pronto para ver as 3 direções? | Envie as respostas e pode fechar a página. Avisamos no seu painel quando ficarem prontas. |
| Endereço e revisão | Onde o seu site vai morar? | Escolha o endereço, confira o site pronto e aprove. |

### Microcopy

- **Step label:** `Passo N de 7` on wide screens; the sprout progress shows the step on phones.
- **Next button:** `Próximo: <etapa>` (says where it goes). Step 6: `Ver as 3 direções` (or `Criar outras 3 direções` on a redo). Step 7: `Aprovar e publicar` when the finished site is ready, otherwise `Ir para o painel`.
- **Back:** Voltar
- **Errors** (say what to do, never apologize; every form error is pt-BR, a test checks it): *Informe o nome do negócio.* / *Escolha o tipo de negócio.* / *Informe pelo menos um contato: WhatsApp, telefone ou e-mail.* / *Confirme que as pessoas da foto autorizaram o uso.* / *Use até 80 caracteres.* (limits vary by field)
- **Blocked topic:** *Esse tipo de negócio a gente não atende.* / *Pelo que você escreveu, o site seria sobre {tema}, e isso a BrotaSites não publica. Nada foi cobrado. Se entendemos errado, ajuste o texto acima.*
- **Autosave:** Salvando… / Respostas salvas na sua conta / Salvo neste aparelho, mas não na sua conta
- **Sign-in (/entrar):** *Entre na sua conta* / *Suas respostas e os seus sites ficam guardados na sua conta.* / E-mail, Senha, **Entrar** / *Entrar com um link no e-mail* · *Esqueci a senha* · *Ainda não tem conta? Criar conta*. Errors never say which part is wrong: *E-mail ou senha incorretos.*
- **Sign-up (/cadastro):** *Crie a sua conta* / *É grátis. Suas respostas e os seus sites ficam guardados na sua conta.* / Seu nome, E-mail, Senha (*Pelo menos 10 caracteres. Evite senhas comuns e o seu e-mail.* and a meter: Fraca demais, Aceitável, Boa, Forte, Muito forte), *Li e aceito os Termos de uso e a Política de Privacidade.*, **Criar conta**. Then *Confira o seu e-mail* with *Reenviar e-mail de confirmação* (once a minute, with the seconds left) and *Usar outro e-mail*.
- **Same answer for any email:** *Se houver uma conta com {email}, enviamos um link…* (sign-in link, password reset, resend).
- **Account (/conta):** *Sua conta*, then *Seus dados* (name, *WhatsApp (opcional)*), *E-mail*, *Senha* or *Criar senha*, *Verificação em duas etapas* (team only), *Aparelhos conectados* (*Sair de todos os aparelhos*), *Seus dados* (*Baixar meus dados (.json)*), *Excluir minha conta*. Sensitive changes: *Por segurança, confirme que é você: entre de novo e repita o pedido em até 10 minutos.*

## Painel (account dashboard, E16)

- **Greeting:** *Olá, {primeiro nome}* (or *Olá*), the email and *Perfil e segurança*.
- **Precisa de você:** one card per pending action, most urgent first: the email banner (*Confirme o seu e-mail.* with *Reenviar e-mail de confirmação*), *{site}: {status label}* with the status sentence (or the visible reason for *Precisa de atenção*), *Continue de onde parou: {etapa}.*, *Complete o seu perfil* / *Diga como podemos chamar você. O WhatsApp é opcional.* Nothing pending: *Tudo em dia.*
- **Seus sites:** status label and sentence, *Última mudança em {data}*, the milestones (*Criado*, *Direções prontas*, *Em revisão*, *Aprovado*, *Publicado*), the button (*Continuar*, *Escolher direção*, *Revisar*, *Baixar o site*, *Ver detalhes*), and once published *Endereço*, *Hospedagem incluída até {data}*, *Alterações incluídas: {n} dias restantes* (or *Período encerrado*). No sites: *Crie seu primeiro site* / *Responda sete perguntas sobre o seu negócio e receba 3 direções de visual para escolher.* / *Criar meu site*.
- **Avisos:** *As 3 direções de {site} estão prontas.*, *{site} está pronto para você conferir.*, *Nossa equipe pediu ajustes em {site}. Estamos montando de novo.*, *{site} está no ar.*, *{site} foi suspenso. Veja os motivos na página do site.*, *A suspensão de {site} foi retirada.*, *Seu e-mail foi confirmado.* / *Marcar todos como lidos* / *Nenhum aviso por enquanto.*
- **Menu:** *Painel*, *Criar site*, *Perfil e segurança*, *Sair* (signed out: *Entrar*, *Criar conta*).

## Each site's page (`/meus-sites/<site>`)

- **Statuses:** the labels and sentences of `apps/platform/src/lib/site-status.ts`, one per status of `docs/product.md` (*Criando as 3 direções*, *Escolha uma das 3*, *Montando seu site*, *Dando uma última olhada*, *Site pronto para conferir*, *Colocando no ar*, *No ar*, *Precisa de atenção*). A small *Sua vez* tag marks the sites waiting on the client.
- **Directions:** *Escolha uma das 3* / *Escolher uma direção fixa a identidade do site (cores, letras e formas). Depois, ainda dá para mudar textos, fotos, contato e seções.* Cards: *Fiel à marca* (*Segue de perto as suas cores e o seu jeito.*), *Evolução* (*Parte da sua marca e dá um passo além.*), *Contraste* (*Um caminho diferente, para comparar.*). *Escolher esta* asks once more: *Escolher “{direção}”? A identidade fica fixa depois disso.* Redo: *Nenhuma serviu: criar outras 3*.
- **Finished site:** *Um endereço particular, só para você conferir. Ele não aparece no Google.* / *Ver o site pronto* / *Aprovar e publicar*.
- **Changes:** *Pedir ajustes* / *Mude o que quiser nas respostas e peça uma nova versão. A identidade aprovada continua a mesma.* / *Montar o site de novo com as mudanças*.
- **Payment (stub):** *Publicar o site* / *Pagamento único. Sem mensalidade.* / *Ambiente de teste: o pagamento por Pix e cartão ainda não está ligado. Este botão simula um pagamento aprovado; nada é cobrado.* / *Simular pagamento aprovado*.

## Admin panel (team only)

Plain and short, in pt-BR like the rest of the platform. Titles: *Fila de revisão* (tabs *Em revisão*, *Precisa de atenção*, *Suspensos*), the site's name, *Catálogo*. Actions: *Aprovar para o cliente*, *Pedir ajustes*, *Suspender*, *Retirar a suspensão*; on the catalog, *Recomendar*, *Aposentar*, *Voltar ao normal* and *Registrar pedido*. A note is required to ask for changes and to suspend: *Escreva o motivo: o cliente e o registro precisam dele.* People who are not admins see *Acesso restrito*.
