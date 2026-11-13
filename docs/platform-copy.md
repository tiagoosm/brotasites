# Platform copy

Copy for the BrotaSites platform: the public site and the form. User-facing text is pt-BR; notes are in English. Written on 2026-10-20 with the slogan chosen by the project owner.

## Voice

- **Who reads it:** people who run a business and want a site without learning technology. The copy never names the size or type of business ("pequeno negócio", "de bairro"): it talks to *seu negócio*, so a bakery, a clinic and a studio all feel addressed.
- **Tone:** warm, plain and confident. Short sentences, everyday verbs, sentence case, no exclamation marks, no em dashes.
- **Scannable (E19):** a reader gets each block at a glance. One idea per block; supporting text of one or two short lines; answers lead with the yes or no. Detail lives in Ajuda and the legal pages, not on every screen.
- **Promise only what the product does.** No invented numbers, prices, testimonials or rankings. Items that depend on open decisions are marked `[pendente]`.
- **The slogan is the structure.** The form really has 5 steps (E25, owner's decision of 2026-11-05: *passo*, never *etapa* nor *pergunta* for the form's parts), and the support line always says the rest: choosing among 3 looks and publishing. The client is never led to think the site comes out ready without choosing and approving.

## Slogan

**5 passos e seu site pronto.**

Support line, right under it wherever there is room (hero, page description, footer, share image): *Responda, escolha entre 3 visuais e publique.*

Until 2026-11-05 the slogan was *Sete perguntas e seu site pronto.*; of those 7 items, the last two were not questions (sending and seeing the 3 directions; the address, approval and payment), and each item held several questions.

## Public site

Built on 2026-10-24 (design: [superpowers/specs/2026-10-24-main-site-design.md](superpowers/specs/2026-10-24-main-site-design.md)). The text lives in the code: `apps/platform/src/app/(site)/page.tsx` and `apps/platform/src/content/` (`faq.ts`, `stem.ts`, `legal.ts`). This section records the decisions behind it.

### Price

- Model (2026-10-25): one-time payment per site, no monthly plan. All values live in `apps/platform/src/config/pricing.ts` (publish R$ 297, optional `launchPrice` shown with the regular price crossed out, 12 months of hosting, 30 days of dashboard changes, optional renewal R$ 99/year, the client's own domain included and optional since 2026-11-04 (`customDomainIncluded`), 7-day guarantee).
- Section *Quanto custa*: *Criar e ver o site pronto é grátis. Você só paga para publicar.* Included: hosting months, dashboard changes days, *O site é seu: baixe quando quiser*, *Domínio próprio, se você quiser (o registro do domínio é por sua conta)* (`customDomainNote`). Below: renewal (*R$ 99 por ano, se quiser renovar. Sem renovar, você baixa o site antes.*) and the guarantee. The guarantee and refund texts show *pendente de revisão jurídica* until `legalReviewed` is true.
- No comparisons with freelancers or competitors.

### Home page

- **Header:** see "Header (every page)" below (E17, E18).
- **Main button:** *Criar meu site*, in the hero, after the 5 steps and in the final call.
- **Hero:** *5 passos e seu site pronto.* / *Responda, escolha entre 3 visuais e publique.* / **Criar meu site** · a smaller *Ver como funciona* text link. Under them, three short facts: *5 passos* (*Salvos na sua conta.*), *3 direções* (*Você escolhe uma.*), *Criar é grátis* (*Paga só para publicar.*). One term for the art directions on every screen: *direção*. The "Experimente aqui" demo and the example site were removed (owner decision of 2026-10-29). With a mouse, a faint vine follows it over the free space of the page. The soft morning light from the top right corner moved to the sign-in page (owner's decision of 2026-11-05). The sign-in and sign-up pages are one frame: the same card on the paper with the morning light behind it; only the card's content changes (owner's decision of 2026-11-05).
- **Como funciona:** *5 passos, um de cada vez.* / *Tudo fica salvo. Feche e volte quando quiser.* Then the 5 steps, exactly as in the form (`formSteps12`), each labeled *Passo N de 5 · {título}* with a few words from `content/stem.ts` and a still picture, then two closings without a number: *Escolha entre 3 visuais* (*Receba 3 propostas feitas com as suas respostas e escolha uma. Depois, confira, aprove e publique.*) and *Pronto. Seu site no ar.*
- **O que todo site tem:** *Já vem pronto, sem configurar.* WhatsApp a um toque; Aberto ou fechado, na hora; Como chegar (*Um toque abre a rota até você no mapa.*: client sites have no embedded map, only the button); Feito para o celular; Pronto para o Google. One short line each.
- **Quanto custa:** see Price above.
- **Dúvidas:** the four questions marked `main` in `content/faq.ts`, and *Ver todas as dúvidas*.
- **Final call:** *Seu site começa com 5 passos.* / *Criar é grátis. Você só paga para publicar.*

### Help, terms and privacy

- Help answers say only what the product does today. Open decisions are stated as such; changes after publishing *ainda está sendo definida*; account deletion is done on request.
- Terms and privacy are first drafts in plain language, marked *Versão inicial, em revisão jurídica*. They need a lawyer's review before BrotaSites accepts clients.
- Responsible party and contact e-mail: pending (`src/content/contact.ts`). Pages say *a definir*; nothing shows an address until it exists.

### Meta

- **Title:** BrotaSites · 5 passos e seu site pronto
- **Description:** 5 passos e seu site pronto. Responda, escolha entre 3 visuais e publique. Sem código.
- **Share image:** `src/app/opengraph-image.png`, made by `scripts/og-image.mjs`: *5 passos e seu site pronto.* with the support line underneath (alt text in `opengraph-image.alt.txt`). The footer and the web app manifest say the same.

## The 5 steps (form)

Since E10 the form follows `docs/form-flow.md`. Titles, questions and descriptions live in `formSteps12` (`packages/schema/src/v1.2/form.ts`).

| Step (rail) | Title (question) | Description |
| --- | --- | --- |
| Seu negócio | Qual é o seu negócio? | Quanto mais detalhe real, mais o site fica com a sua cara. |
| Marca e sensação | Como você quer que o seu negócio pareça? | Logo e cores são opcionais. Sem logo, criamos um monograma. |
| Seções | O que o seu site vai mostrar? | O essencial para o seu negócio já vem ligado. |
| Conteúdo | O que você oferece? | Escreva do seu jeito: a gente arruma o texto. |
| Contato | Como os clientes falam com você? | Pelo menos um canal: WhatsApp, telefone ou e-mail. |


After the 5 steps, two phases that are not numbered: choosing one of the 3 directions (on the site's page, *Escolha uma das 3*) and **Publicar** (`/meus-sites/<site>/publicar`: *Onde o seu site vai morar?* / *Escolha o endereço, confira o site pronto e aprove.*).

### Microcopy

- **Step label:** `Passo N de 5` on wide screens; the sprout progress shows `Passo N de 5` on phones. The page title is *Passo N de 5: {título}*.
- **Next button:** `Próximo: <passo>` (says where it goes). Step 5 ends with *Confira antes de enviar* (the answers of steps 1 to 4, each with *Mudar*) and **Enviar e ver as direções** (after sending, *Salvar e voltar ao site*). Publicar: **Aprovar e publicar** when the finished site is ready, otherwise *Acompanhar o site*.
- **Back:** Voltar
- **Errors** (say what to do, never apologize; every form error is pt-BR, a test checks it): *Informe o nome do negócio.* / *Escolha o tipo de negócio.* / *Informe pelo menos um contato: WhatsApp, telefone ou e-mail.* / *Confirme que as pessoas da foto autorizaram o uso.* / *Use até 80 caracteres.* (limits vary by field)
- **Blocked topic:** *Esse tipo de negócio a gente não atende.* / *Pelo que você escreveu, o site seria sobre {tema}, e isso a BrotaSites não publica. Nada foi cobrado. Se entendemos errado, ajuste o texto acima.*
- **Autosave:** Salvando… / Respostas salvas na sua conta / Salvo neste aparelho, mas não na sua conta
- **After a password reset (E30):** on /entrar, *Senha alterada. Entre com a nova senha.* (every session ended with the change).
- **Sign-in (/entrar):** *Entre na sua conta* / *Suas respostas e sites ficam guardados aqui.* / E-mail, Senha, **Entrar** / *Esqueci a senha*. No sign-in link by email (removed by the owner on 2026-11-05). After the button, next to *Esqueci a senha*: *Ainda não tem conta? Cadastre-se* (E26; the header's "Entrar ou cadastre-se" leads here). Errors never say which part is wrong: *E-mail ou senha incorretos.*
- **Sign-up (/cadastro):** *Crie a sua conta* / *É grátis. Seus sites ficam guardados nela.* / Seu nome, E-mail, Senha, Repita a senha, *Li e aceito os Termos de uso e a Política de Privacidade.* (one sentence, the two names are the links; no second line of links), **Criar conta** (*Criando…*), *Já tem conta? Entrar* under the terms.
- **Passwords (E26, E27; sign-up, *Crie uma nova senha*, *Perfil e segurança*):** only the requirement shows (E30): *Mínimo:* with the pill *8 caracteres* under the password (a check once met, a quiet dash before; screen readers hear *Feito:* or *Ainda não:*). The kinds of character (lowercase, uppercase, number, symbol) are no longer listed but still raise the strength. On the label row, *Força: Fraca / Boa / Forte*, with a thin three-part bar under the field, only once something is typed (E30). Errors: *Use pelo menos 8 caracteres.*, *Use até 128 caracteres.*, *Essa senha apareceu em vazamentos de dados. Escolha outra.* (Supabase). Repeated password: *As senhas são iguais.* / *As senhas não são iguais.*, said once the field is left or typed in full, on a line whose height is kept. *Caps Lock está ligado.* Sending with errors (E29): each error once, under its field, announced (`role="alert"`), and focus on the first field with one; no summary at the top, and no general message repeating the fields' errors. Email typo: *Você quis dizer voce@gmail.com?* (the address is a button that accepts it). Then *Confira o seu e-mail* with *Reenviar e-mail de confirmação* (once a minute, with the seconds left) and *Usar outro e-mail*.
- **Same answer for any email:** *Se houver uma conta com {email}, enviamos um link…* (password reset, resend).
- **Account (/conta):** *Sua conta*, then *Seus dados* (name, *WhatsApp (opcional)*), *E-mail*, *Senha* or *Criar senha*, *Verificação em duas etapas* (team only), *Aparelhos conectados* (*Sair de todos os aparelhos*), *Seus dados* (*Baixar meus dados (.json)*), *Excluir minha conta*. Sensitive changes: *Por segurança, confirme que é você: entre de novo e repita o pedido em até 10 minutos.*

## Meus sites (/meus-sites; "Painel" until E26)

- **Contact (E28; email only, no form):** footer (full, not the compact one), one quiet line: *Fale com a gente: contato@brotasites.com.br* (a `mailto:` link). Ajuda's last section, *Fale com a gente* (also in its table of contents): *Não achou a resposta? Escreva para contato@brotasites.com.br.* Privacidade: *Contato para assuntos de privacidade: privacidade@brotasites.com.br.* and *Para pedir acesso, correção ou exclusão de qualquer outro dado, ou para tirar dúvidas, escreva para privacidade@brotasites.com.br.* Termos: *Contato: contato@brotasites.com.br.* and, under *O que não é permitido*: *Viu um site feito no BrotaSites que descumpre estas regras? Denuncie por e-mail para abuso@brotasites.com.br, com o endereço do site e o motivo.* Addresses in the legal texts are links. Until the platform has its domain, each says *a definir*. Examples of a site's address read *seunegocio.brotasites.com* (the real sites domain when set).
- **Name:** *Meus sites* in every text a person reads (profile menu, phone menu, footer, the page's title and heading, buttons such as *Ir para Meus sites*, *← Meus sites*, the notices, the terms: *Avisamos em Meus sites*, *Ajustes em Meus sites nos primeiros 30 dias*). `/painel` leads to `/meus-sites` (permanent redirect, query kept).
- **Top:** *Meus sites*, with a small line *Olá, {primeiro nome}* (or *Olá*), the email and *Perfil e segurança*; *Criar outro site* (the E24 slot rule unchanged) and the bell on the right.
- **Account band** (only when there is something, no *Tudo em dia*): the email banner (*Confirme o seu e-mail.* with *Reenviar e-mail de confirmação*) and *Complete o seu perfil. Diga como podemos chamar você. O WhatsApp é opcional.* with *Completar perfil*.
- **One card per site**, the ones waiting on the person first (most urgent first): the name and the status badge (*Sua vez*, *Gerando*, *Em revisão*, *Publicando*, *No ar*, *Precisa de atenção*, *Suspenso*), one sentence (*Continue de onde parou: passo 3 de 5 (Conteúdo).*, *Escolha uma das 3 direções.*, the visible reason for *Precisa de atenção*, or the status sentence), one main button (*Continuar*, *Escolher direção*, *Publicar*, *Baixar o site*, or *Abrir* when there is nothing more specific; E29: *Ver detalhes* and *Ver o que falta* became *Abrir*), filled only on *Sua vez* and *Precisa de atenção*. The site's name is the link to its page (E29: no *Detalhes*). Below, quieter: the milestones (*Criado*, *Direções prontas*, *Em revisão*, *Aprovado*, *Publicado*), or *Última mudança em {data}* when there are none, once published *Endereço* (the only link to the live site; E29: no *Ver o site*), *Hospedagem incluída até {data}*, *Alterações incluídas: {n} dias restantes* (or *Período encerrado*), and for unpaid sites waiting on the client *Guardado até {data}.* with *Qualquer mudança renova o prazo.* (in the last 7 days *Sem novidades, ele será apagado.*) and *Descartar*. With a site in progress, *Criar outro site* is disabled with *Termine e publique o site que está em andamento para criar outro. Ou descarte-o.* and *Ir para o site em andamento*. No sites: *Crie seu primeiro site* / *5 passos e você escolhe entre 3 visuais.* / *Criar meu site*.
- **Avisos:** *As 3 direções de {site} estão prontas.*, *{site} está pronto para você conferir.*, *Nossa equipe pediu ajustes em {site}. Estamos montando de novo.*, *{site} está no ar.*, *{site} foi suspenso. Veja os motivos na página do site.*, *A suspensão de {site} foi retirada.*, *Seu e-mail foi confirmado.*, *{site} será apagado em {n} dias se não houver novidades.* (*amanhã* on the last day) / *Marcar todos como lidos* / *Nenhum aviso por enquanto.*
- **Header (every page, E17):** *Como funciona*, *Preço*, *Ajuda* in the middle (E29: *Dúvidas* left the header; Ajuda answers the same questions, and the home page keeps its *Dúvidas* section with *Ver todas as dúvidas*). Signed out (E30): **Entrar** (quiet, to /entrar) and **Criar conta** (the highlight, to /cadastro); /entrar shows only *Criar conta*, /cadastro only *Entrar*, the password screens neither (the brand leads back). The phone menu ends with *Criar conta* on top and *Entrar* under it, by the same rule (E26: a visitor never sees *Criar meu site* in the header or the phone menu, since it only led to signing in; the home page keeps its own *Criar meu site* buttons in the hero and the sections). Signed in (E32, owner's request): only the profile button (*Menu da conta*, *Menu da conta de {nome}*), no *Criar meu site* in the header; its menu shows the name and email, then *Meus sites*, *Perfil e segurança*, *Área da equipe* (team only) and *Sair*, the same on every page (the current page stays listed, marked). Phone sheet: the three links (never the current page), then, signed in, *Sua conta* with the same account items, the current one marked, and no main button. Signed in, every *Criar meu site* (home, Ajuda, a sign-in that started from one) leads to Meus sites; the form opens from there (*Criar outro site*, or the first site's *Criar meu site*). **Footer (E29):** only what the header lacks: *Termos de uso*, *Privacidade* and, in the full footer, the contact line.

## Each site's page (`/meus-sites/<site>`)

- **Statuses:** the labels and sentences of `apps/platform/src/lib/site-status.ts`, one per status of `docs/product.md` (*Criando as 3 direções*, *Escolha uma das 3*, *Montando seu site*, *Dando uma última olhada*, *Site pronto para conferir*, *Colocando no ar*, *No ar*, *Precisa de atenção*). A small *Sua vez* tag marks the sites waiting on the client.
- **Directions:** *Escolha uma das 3* / *Escolher uma direção fixa a identidade do site (cores, letras e formas). Depois, ainda dá para mudar textos, fotos, contato e seções.* Cards: *Fiel à marca* (*Segue de perto as suas cores e o seu jeito.*), *Evolução* (*Parte da sua marca e dá um passo além.*), *Contraste* (*Um caminho diferente, para comparar.*). *Escolher esta* asks once more: *Escolher “{direção}”? A identidade fica fixa depois disso.* Redo: *Nenhuma serviu: criar outras 3*, with *Você usou {n} de 2 refazeres grátis.* under it; past the free rounds the button is disabled and says *Próxima rodada disponível às {15h40}.* (or *em {05/11} às {15h40}*) *Depois dos refazeres grátis, você pode pedir mais 1 rodada a cada hora.* Step 6 says *Escolha uma ou peça outras 3: são 2 refazeres grátis.*
- **Discard (every unpaid site in progress, drafts included, also while we work on it; on the site's page and, since 2026-11-05, on the dashboard card):** *Descartar este site* (card: *Descartar*) / *Libera a vaga para criar outro site.* / *Apagar este site, as respostas e as fotos? Isso não pode ser desfeito.* (card: *Apagar {site}, ...*; while we work on it, *O que estamos preparando para ele para na hora.*) / *Sim, descartar* · *Cancelar*.
- **Finished site:** *Um endereço particular, só para você conferir. Ele não aparece no Google.* / *Ver o site pronto* / *Aprovar e publicar*.
- **Changes:** *Pedir ajustes* / *Mude o que quiser nas respostas e peça uma nova versão. A identidade aprovada continua a mesma.* / *Montar o site de novo com as mudanças*.
- **Payment (stub):** *Publicar o site* / *Pagamento único. Sem mensalidade.* / *Ambiente de teste: o pagamento por Pix e cartão ainda não está ligado. Este botão simula um pagamento aprovado; nada é cobrado.* / *Simular pagamento aprovado*.

## The client's own domain (E25)

On the page of a published site, *Usar o seu próprio domínio* / *Opcional e incluído no preço: o site também abre em seunegocio.com.br. O registro do domínio é por sua conta, no registrador.* Field *Seu domínio* and **Conectar domínio**. States (`lib/domains/copy.ts`): *Aguardando configuração*, *Verificando*, *Ativo*, *Com problema* (with the reason: the records are gone, 7 days without finding them, refused, or connected in another service, each ending in *tente de novo*), *Removido*. *Como configurar*: where the DNS is at the registrar, the records with **Copiar** (*Copiado*), the redirect of the root to the www, how long it may take, what to check if it fails. **Verificar agora**, *Endereço principal* (the own domain or the BrotaSites address), *Remover domínio* with *Desconectar {domínio}? O site continua no endereço da BrotaSites.* Refusals say how to fix the input and never show the hosting's text. On Publicar, *Domínio próprio (opcional)* / *Seu domínio, se tiver*, only a note. Notices: *O domínio próprio de {site} está ativo.* and *Não conseguimos verificar o domínio próprio de {site}.*

## Admin panel (team only)

Plain and short, in pt-BR like the rest of the platform. Titles: *Fila de revisão* (tabs *Em revisão*, *Precisa de atenção*, *Suspensos*), the site's name, *Catálogo*. Actions: *Aprovar para o cliente*, *Pedir ajustes*, *Suspender*, *Retirar a suspensão*; on the catalog, *Recomendar*, *Aposentar*, *Voltar ao normal* and *Registrar pedido*. A note is required to ask for changes and to suspend: *Escreva o motivo: o cliente e o registro precisam dele.* People who are not admins see *Acesso restrito*. E24 adds *Visão geral*, *Custos*, *Contas* and *Limites*: empty figures say *sem dados ainda*, estimates in reais say *(estimativa)* and the rate is marked *a verificar*; the budget warns *O orçamento diário de IA passou de 80%.* and *O orçamento diário de IA acabou: hoje o motor trabalha sozinho.*; every exception asks for *Motivo (fica no log)* and a second click, then says *Feito. A ação foi registrada no log.* E42 adds the *Sites* tab (*Sites publicados*, filters *Todos*, *No ar*, *Fora do ar*, *Exclusão agendada (N)*, the *Exclusões agendadas* counter) and, on a site's page, *Retirada do ar*: *Tirar do ar*, *Recolocar no ar*, *Agendar a exclusão*, *Cancelar a exclusão*, *Excluir agora*; each asks for a *Nota* (and a *Motivo* from a list to take offline or schedule), *Mostrar a nota ao cliente na página do site* is optional, and *Excluir agora* asks to type the address. The client's side says *Gerenciar o site*, *Tirar do ar*, *Recolocar no ar*, *Excluir o site*, *Excluir daqui a 7 dias* and *Cancelar a exclusão*, and never promises a refund.

## The team's sign-in (E33)

- Page title: *Entrar na área da equipe*. Header tag: *Área da equipe*.
- Card: **Área da equipe** / *Entre com o e-mail e a senha da sua conta de equipe.* / *E-mail*, *Senha* / **Entrar** (*Entrando…* while it works) / a quiet line: *Esqueceu a senha? Redefina no site da BrotaSites.*
- An account not on the team: **Sem acesso** / *Esta conta não tem acesso à área da equipe.* / *Você saiu desta conta aqui.* / **Entrar com outra conta** · *Ir para o site*.
- Panel reminder, team only, while the second step is off: *A verificação em duas etapas está desligada.* *Para religar, rode no SQL do Supabase:* `update public.team_settings set require_second_factor = true;`
- *Acesso restrito* (a signed-in client on /admin): *Esta área é só para a equipe da BrotaSites.* · *Ir para o site*.
