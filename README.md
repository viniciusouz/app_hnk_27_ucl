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

## Variaveis de ambiente (`.env.example`)

| Variavel | Descricao | Padrao / Exemplo |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | URL publica usada em links `/s/[id]` e Open Graph | `http://localhost:3033` |
| `NEXT_PUBLIC_CLUBE_HEINEKEN_URL` | Link de cadastro no Clube Heineken | `https://clube.heineken.com.br/` |
| `N8N_WEBHOOK_URL` | Webhook do n8n para Modo A (opcional) | vazio |
| `GEMINI_API_KEY` | Chave Gemini para Modo B direto (opcional) | vazio |
| `NANO_BANANA_MODEL` | Modelo Gemini de composicao | `gemini-nano-banana-2.1` |
| `INTERNAL_SIGNING_SECRET` | Segredo HMAC e header `x-internal-secret` | `dev-secret-trocar-em-producao-hnk-ucl-2027` |
| `AI_TIMEOUT_MS` | Timeout do watchdog local e chamada Gemini (ms) | `90000` |
| `DRIVE_OUTPUT_DIR` | Pasta de destino para gravacao de selfies e resultados pelo n8n | opcional |
| `BLOB_READ_WRITE_TOKEN` | Token do Vercel Blob (opcional em producao) | vazio |
| `MAX_GENERATIONS_PER_DEVICE_PER_DAY` | Limite diario por dispositivo | `5` |
| `MAX_GLOBAL_GENERATIONS_PER_DAY` | Limite global diario | `500` |
| `BYPASS_RATE_LIMIT_LOCAL` | Desliga rate limit em testes locais (`true`/`false`) | `false` |
| `CRON_SECRET` | Segredo opcional `Bearer` para `/api/internal/cleanup` | opcional |

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

1. Abra o workflow no editor do n8n Cloud e importe `n8n/workflow-arquibancada-ucl2027-cloud.json` (nao utiliza variaveis `$env` nem segredos fixos no JSON).
2. Clique em **Save** e ative/publique (**Publish**) o workflow.
3. Defina `N8N_WEBHOOK_URL=https://viniciusouza.app.n8n.cloud/webhook/arquibancada-ucl2027` no `.env.local` (ou variaveis da Vercel) junto com `GEMINI_API_KEY`.

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
