# BrotaSites

Plataforma onde o cliente preenche um formulário e recebe uma landing page publicada automaticamente, sem ver código. Só landing pages por enquanto.

Dono do projeto: Tiago da Silva Machado (github.com/tiagoosm). Idioma do produto e dos textos: português do Brasil.

## Como trabalhar neste projeto

- Responda e comente em português. Código, nomes de arquivos e de variáveis em inglês.
- Faça uma etapa por vez, mostre o que mudou e rode os testes antes de seguir.
- Não instale tecnologias fora da stack abaixo sem perguntar.
- Fixe versões estáveis no `package.json`. Nada de `latest`.
- Nunca grave segredos (chaves de API, tokens) no repositório. Use `.env.local` (no `.gitignore`) e mantenha um `.env.example`.
- Commits pequenos, mensagens em português no imperativo (ex.: "Adiciona schema Zod da landing page").
- Pergunte antes de qualquer ação irreversível ou que gere custo (comprar domínio, publicar em produção, criar projetos pagos).

## Decisões já tomadas

- Linguagem: TypeScript em tudo. Monorepo com pnpm + Turborepo.
- Plataforma (painel, formulário, API): Next.js (App Router), Tailwind e shadcn/ui.
- Banco, login (link mágico) e arquivos: Supabase. Guarda só dados da plataforma (`users`, `sites`, `site_configs`, `jobs`, `assets`). Os sites dos clientes são estáticos, sem banco.
- Validação: Zod em `packages/schema`, fonte única de verdade para formulário, API, IA e gerador. Referência inicial: `docs/site-config.schema.json` (versão 1.1).
- Sites gerados: Astro + Tailwind, HTML estático, lendo o JSON de configuração.
- Deploy dos sites: Cloudflare Pages (um projeto por cliente), em `cliente.brotasites.com`.
- IA (Claude via SDK da Anthropic): gera só textos e ajustes, sempre devolvendo JSON validado pelo schema. Nunca gera código livre.
- Testes: Vitest (schema e gerador) e Playwright (fluxo completo). CI no GitHub Actions.
- Depois do MVP: fila de tarefas (Inngest ou Trigger.dev) e pagamento (Asaas ou Mercado Pago).

## Regras da IA (inegociáveis)

- Nunca inventar depoimentos, avaliações, números, prêmios, certificações ou dados de contato.
- Seção de depoimentos só liga se o cliente cadastrar ao menos um depoimento real.
- Textos factuais (preços, horários, endereço, anos de história) vêm apenas do formulário. A IA só reescreve e organiza.
- Campos editados à mão pelo cliente ficam em `ai.userEditedFields` e nunca são sobrescritos.
- Se a saída da IA falhar na validação: tentar de novo uma vez e depois marcar o site como "em revisão".

## Estrutura planejada

```
brotasites/
├── apps/
│   └── plataforma/        # Next.js: painel, formulário, API
├── packages/
│   ├── schema/            # Zod + tipos (coração do projeto)
│   ├── templates/         # modelos de landing page em Astro
│   └── gerador/           # lê o JSON e monta o site estático
├── docs/                  # schema JSON, exemplo e fluxo do formulário
├── CLAUDE.md
└── README.md
```

## Documentos de referência (pasta `docs/`)

- `site-config.schema.json`: formato do JSON de configuração (v1.1).
- `site-config.exemplo.json`: exemplo preenchido (Padaria do Zé).
- `fluxo-formulario.md`: etapas do formulário e quais campos cada uma preenche.

## Pontos em aberto

- Quantos templates no lançamento (sugestão: 2 ou 3 bem feitos).
- Pagamento antes ou depois da geração.
- Política de ajustes inclusos após a publicação.
- Domínio e marca: `brotasites.com.br` já está registrado por terceiros. Domínio principal sugerido: `brotasites.com`. Consultar INPI antes de investir na marca.
