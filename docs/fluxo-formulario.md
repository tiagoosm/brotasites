# Fluxo do formulário (landing pages)

Objetivo: o cliente responde em poucos minutos e recebe o site no ar, sem ver código. Cada etapa preenche uma parte do JSON de configuração (`site-config.schema.json`).

## Princípios

- 7 etapas curtas, uma decisão principal por tela.
- Prévia ao vivo do site ao lado (ou acima, no celular) em todas as etapas, atualizada a cada mudança.
- Salvamento automático a cada etapa: o cliente pode fechar e voltar depois.
- Validação por etapa com o schema, com mensagens em português claro.
- Tudo que a IA gera aparece como sugestão editável, nunca como algo já aprovado.
- Layout pensado primeiro para celular, porque muitos clientes vão preencher pelo telefone.

## Etapas

### 0. Entrada
- Login por e-mail (link mágico), sem senha.
- Cria o registro do usuário e um rascunho de site.

### 1. Seu negócio
- Campos: nome do negócio, tipo/categoria (lista com opção "outro"), cidade.
- JSON: `business.name`, `business.category`, `business.contact.address.city`.
- A categoria escolhida pré-seleciona template, paleta e seções sugeridas.

### 2. Modelo
- Cards com 4 modelos (`classico`, `moderno`, `minimalista`, `vibrante`), cada um com prévia já usando o nome do negócio.
- JSON: `design.template`.

### 3. Cores e fontes
- Paletas prontas sugeridas para a categoria, mais seletor de cor livre para quem quiser.
- Combinações de fonte em lista fechada (título + texto).
- Aviso automático de contraste ruim (texto ilegível sobre o fundo) antes de avançar.
- JSON: `design.colors.*`, `design.fonts.*`, `design.style.*`.

### 4. Seções
- Lista com liga/desliga e ordem ajustável: hero, sobre, serviços, galeria, depoimentos, FAQ, chamada final, contato.
- Seções recomendadas para a categoria já vêm ligadas.
- JSON: `sections[].enabled` e a ordem do array.

### 5. Conteúdo
- Uma seção ligada por vez, com os campos de texto dela.
- Botão "Sugerir com IA" em cada campo de texto: o cliente descreve em uma frase e a IA propõe o texto (tom escolhido em `ai.tone`).
- Campos editados à mão entram em `ai.userEditedFields` e não são sobrescritos em regenerações.
- JSON: `business.tagline`, `business.description`, `sections[].content`, `seo.*`.

### 6. Contato e imagens
- WhatsApp, telefone, e-mail, endereço, horários, Instagram.
- Upload de logo e fotos, com limite de tamanho e formato, e redimensionamento automático.
- JSON: `business.contact.*`, `business.social.*`, `business.logo`, imagens das seções.

### 7. Endereço do site e revisão
- Escolha do subdomínio, com verificação de disponibilidade em tempo real.
- Resumo final com a prévia em tela cheia e botão de pagamento.
- JSON: `site.subdomain`.

### 8. Acompanhamento
- Tela de status: "gerando" → "publicando" → "no ar" (ou "em revisão" se algo falhar).
- Ao concluir: link do site, botão de compartilhar no WhatsApp e atalho "pedir ajuste".

## Regras para a IA (importante)

- Nunca inventar depoimentos, avaliações, números, prêmios, certificações ou dados de contato. Esses campos só entram com o que o cliente informou.
- Seção de depoimentos só pode ser ligada se o cliente cadastrar ao menos um depoimento real.
- Textos factuais (preços, horários, endereço, anos de história) vêm apenas do formulário; a IA só reescreve e organiza.
- Saída da IA sempre em JSON validado pelo schema; se falhar, tenta novamente uma vez e depois sinaliza para revisão.

## Pontos em aberto

- Quantos modelos entregar no lançamento (começar com 2 ou 3 bem feitos pode ser melhor que 4).
- Pagamento antes ou depois da geração (antes reduz custo de testes sem compra; depois deixa o cliente ver o resultado antes de pagar).
- Política de ajustes inclusos após a publicação.
