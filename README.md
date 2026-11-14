# Arquibancada Heineken: UEFA Champions League 2027

Webapp mobile-first para a ativacao **Mais Amigos, Mais Champions.** (Heineken x UEFA Champions League 2027, canais ON-06 e OFF-15).

O usuario confirma a maioridade (18+), sobe uma selfie, informa o nome de 3 amigos, escolhe um apelido proprio e recebe uma foto 4:5 (1080x1350) da arquibancada Heineken personalizada com as 4 cadeiras identificadas em tipografia oficial e pronta para compartilhar no WhatsApp ou baixar.

---

## Principais funcionalidades

- **Fluxo mobile em 6 telas**:
  1. `Idade 18+` (age gate com cookie/sessionStorage e trava legal)
  2. `Home` (hero editorial + seletor de 3 rotas de entrada e `?pitch=1` para apresentacoes)
  3. `Foto` (camera/galeria + orientacoes de enquadramento e consentimento LGPD obrigatorio)
  4. `Nomes` (3 nomes de amigos + moderacao instantanea PT-BR/EN e marcas concorrentes + preview ao vivo nas cadeiras)
  5. `Espera` (loading tematico com timer de acompanhamento e fallback automatico em ate 45s)
  6. `Resultado` (entrada do nome do usuario, composicao final 4:5, download, CTA Clube Heineken e convite direto no WhatsApp com link `/s/[id]`)
- **Pagina publica de convite (`/s/[id]`)**:
  - Open Graph dinamico (`og:image`, `og:title`, `og:description`) apontando para `/api/share-image/[id]`
  - Rastreamento de origem via `?from=[id]`
  - Expiracao automatica apos 24 horas (LGPD)
- **Plano B garantido (100% de entrega)**:
  - Caso o n8n ou a API de geracao de imagem falhe, atinja timeout de 45s ou recuse a selfie, o backend aplica automaticamente os 4 nomes na placa master (`public/pipeline/master.jpg` / `fallback.jpg`) via `sharp` usando as fontes proprietarias (`Heineken Serif 18` e `Heineken Sans`) e a curva Racetrack vetorial oficial.

---

## Estrutura do projeto

```text
arquibancada-ucl2027/
├── n8n/
│   ├── workflow-arquibancada-ucl2027.json         # Workflow local com callback + Cron 24h
│   └── workflow-arquibancada-ucl2027-cloud.json   # Workflow n8n.cloud (Nano Banana 2.1 1K sync)
├── prompts/
│   ├── PROMPT_A_MASTER_4_CADEIRAS.md        # Prompt de geracao da cena master 4:5
│   └── PROMPT_B_COMPOSICAO_USUARIO.md       # Prompt de composicao por usuario (Nano Banana 2.1)
├── public/
│   ├── brand/                               # SVGs vetoriais oficiais (logo horizontal, ext, racetrack)
│   ├── examples/                            # Exemplo renderizado 4:5 (1080x1350)
│   ├── fonts/                               # Fontes proprietarias Heineken Serif 18 e Heineken Sans
│   └── pipeline/                            # master.jpg, fallback.jpg e camisa.png
└── src/
    ├── app/
    │   ├── api/                             # Endpoints publicos e internos (/jobs, /upload, /media, /internal/*)
    │   ├── s/[id]/                          # Rota publica de convite e preview Open Graph
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/                          # AppShell, ArquibancadaFlow, ChairsPreview, InviteView, RacetrackMotif
    ├── config/                              # Copys, blocklist, parametros da campanha e coordenadas das cadeiras
    └── lib/                                 # Composer (sharp), orquestrador, seguranca HMAC, storage e jobStore
```

---

## Como rodar localmente

Requisitos: Node.js 20+ e npm.

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo `.env.local` a partir do modelo `.env.example`:

```bash
cp .env.example .env.local
```

3. Inicie em modo desenvolvimento ou producao local:

```bash
# Desenvolvimento
npm run dev

# Ou build + start de producao (porta padrao 3033)
npm run build
npx next start -p 3033
```

Acesse `http://localhost:3033` (ou `http://localhost:3033/?pitch=1` para alternar as rotas editoriais da Home em demonstracoes).

---

## Seguranca e segredos

Regra unica: **a chave do Gemini mora em um lugar so, dentro do n8n**, como credencial. Ela nao existe no codigo, no navegador, no Git nem trafega entre Next.js e n8n.

| Segredo | Onde vive | Para que serve |
| --- | --- | --- |
| Chave Gemini | Credencial `Google Gemini(PaLM) Api account` no n8n | Chamada ao modelo de imagem |
| `N8N_WEBHOOK_SECRET` | Vercel/`.env.local` **e** credencial Header Auth `HNK Arquibancada \| webhook` no n8n (header `x-internal-secret`) | So o backend consegue acionar o webhook |
| `INTERNAL_SIGNING_SECRET` | Vercel/`.env.local` | Assina URLs de midia (HMAC com validade) e protege `/api/internal/*` |
| `CRON_SECRET` | Vercel | Autentica o cron de limpeza 24h |

Garantias automaticas:

- Em producao, `INTERNAL_SIGNING_SECRET` ausente, curto (menos de 32 caracteres) ou igual ao exemplo derruba a requisicao (falha fechada).
- O CI (`.github/workflows/ci.yml`) roda gitleaks no historico, bloqueia variavel `NEXT_PUBLIC_*` com cara de segredo e varre o bundle do navegador atras de nomes de segredo.
- Headers de seguranca globais (`X-Frame-Options`, `Permissions-Policy` com camera so na propria origem, HSTS).
- O workflow do n8n nao salva dados de execucao: a selfie nao fica no historico do n8n (LGPD, 24h).
- O n8n nao baixa URLs vindas da requisicao (sem SSRF): recebe so base64 validado.

Gere cada segredo com:

```bash
openssl rand -base64 48
```

As variaveis estao documentadas em `.env.example`.

---

## Modos de operacao do pipeline

O modulo `src/lib/orchestrator.ts` escolhe o pipeline automaticamente:

1. **Modo A (`N8N_WEBHOOK_URL` configurado)**:
   - **n8n Cloud (sync inline)**: quando `N8N_WEBHOOK_URL` aponta para `viniciusouza.app.n8n.cloud` (ou URL remota com `N8N_MODE=sync`), o Next.js envia `masterBase64`, `selfieBase64` e `jerseyBase64` inline no webhook, recebe a composicao `1K` de `gemini-nano-banana-2.1`, valida a ocupacao exclusiva da Cadeira 1 (`validateAiSeat1Placement`, com 1 retry automatico), aplica a tipografia com protecao anticolisao via `sharp` e espelha selfie e arte final em `DRIVE_OUTPUT_DIR`.
   - **n8n Local (callback assincrono via `npm run n8n:auto`)**: quando `N8N_WEBHOOK_URL` aponta para `localhost:5678`, o n8n baixa os 3 arquivos, chama `gemini-nano-banana-2.1` (`4:5`, `1K`, `thinkingLevel: HIGH`, retry automatico em HTTP 422), chama `/api/internal/compose` e grava em `DRIVE_OUTPUT_DIR`. Um watchdog local (`AI_TIMEOUT_MS`) aciona o Plano B se o n8n nao concluir no prazo.
2. **Modo B (`GEMINI_API_KEY` configurado, sem n8n)**:
   - O proprio Next.js executa a chamada direta para `gemini-nano-banana-2.1` (`1K`) com o Prompt B (`master.jpg`, selfie privada e `camisa.png`), valida a Cadeira 1, faz a composicao final com `sharp`, espelha em `DRIVE_OUTPUT_DIR` e cai para Plano B em caso de erro ou recusa.
3. **Modo C (Demo local / sem variaveis externas)**:
   - Executa diretamente o Plano B usando `public/pipeline/master.jpg` + aplicacao vetorial/tipografica dos 4 nomes (`VINI`, `JOAO`, `ANDRE`, `VITORIA`, etc.) e rodape legal em `1080x1350`.

---

## Configuracao do n8n Cloud e Local

### n8n Cloud (`https://viniciusouza.app.n8n.cloud/workflow/g0pWpUc5qLrx0wdw`)

Fonte da verdade: `n8n/workflow-arquibancada-ucl2027-cloud.json` (8 nos, sem `$env`, sem segredos).

Fluxo: `Webhook (Header Auth)` -> `Validar Payload` -> `Montar Requisicao Gemini` -> `Gemini Nano Banana` (credencial do n8n) -> `Extrair Imagem` -> resposta sincrona `{ ok, composedImageBase64, modelRefused, finishReason }`. A tipografia dos nomes e a checagem da Cadeira 1 continuam no Next.js.

Para ativar:

1. No n8n, crie a credencial **Header Auth** `HNK Arquibancada | webhook` com Name `x-internal-secret` e Value igual ao `N8N_WEBHOOK_SECRET`.
2. Vincule essa credencial ao no `Webhook Arquibancada` e publique o workflow.
3. No app: `N8N_CLOUD_WEBHOOK_URL=https://viniciusouza.app.n8n.cloud/webhook/arquibancada-ucl2027` e `N8N_WEBHOOK_SECRET=<mesmo valor>`. Deixe `GEMINI_API_KEY` vazio.

A limpeza de 24h nao roda mais no n8n Cloud (ele nao alcanca `localhost`). Ela passa para o Vercel Cron em `/api/internal/cleanup` na fase de deploy.

### n8n Local Automatico (`n8n/workflow-arquibancada-ucl2027.json`)

1. Suba a instancia automatica local com `npm run n8n:auto` (que garante `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, importa e ativa o workflow).
2. Configure `INTERNAL_SIGNING_SECRET`, `GEMINI_API_KEY`, `APP_BASE_URL` e `DRIVE_OUTPUT_DIR` no ambiente e defina `N8N_WEBHOOK_URL=http://localhost:5678/webhook/arquibancada-ucl2027`.
3. O workflow local inclui o gatilho horario (`Cron Limpeza 24h`) chamando `POST /api/internal/cleanup`.

---

## Edicao sem tocar em codigo

- **Textos, botoes e disclaimer legal**: `src/config/copy.config.ts`
- **Limites, tempo de retencao (24h), rotas e metricas**: `src/config/campaign.config.ts`
- **Lista de bloqueio e marcas concorrentes**: `src/config/blocklist.config.ts`
- **Posicao e largura dos nomes nos encostos das cadeiras**: `src/config/seats.config.ts`

---

## Notas sobre producao (Vercel)

- O arquivo `next.config.ts` configura `serverExternalPackages: ["sharp"]` para garantir a execucao nativa do `sharp` nas rotas server-side.
- Em ambiente local e prototipagem, selfies, artes geradas e metadados ficam no diretorio local privado `.data/`.
- Para operacao em escala multi-instancia serverless na Vercel, recomenda-se conectar um storage externo persistente para leitura/escrita/exclusao (por exemplo `@vercel/blob` ou S3) e um banco/KV compartilhado para estado dos jobs e contagem de rate limit.
