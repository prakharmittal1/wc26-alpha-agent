# World Cup 2026 Match Picks

Compare **our win estimate** to **Polymarket odds** for FIFA World Cup 2026 matches. Built with Next.js — no paid data APIs required for a demo.

## Quick start

Works with **no API keys** (bundled demo matches + seed team ratings).

```bash
npm install
npm run dev
# http://localhost:3000
```

Tap a match to see our estimate, market odds, and whether they disagree.

## Optional setup

Copy `.env.local.example` → `.env.local`.

| Feature | Env vars | Notes |
|--------|----------|--------|
| Live schedules | `FOOTBALL_DATA_ORG_TOKEN` | Free at [football-data.org](https://www.football-data.org/client/register) |
| AI commentary | `GOOGLE_GENERATIVE_AI_API_KEY` or `LLM_PROVIDER=ollama` | Gemini Flash-Lite or local Ollama |
| Full history | `data/results.csv` + `npm run data:build` | Kaggle international results CSV (gitignored) |

### Team ratings & match history (Kaggle)

1. Download [International Football Results from 1872 to 2017](https://www.kaggle.com/datasets/martj42/international-football-results-from-1872-to-2017)
2. Save as `data/results.csv`
3. Run:

```bash
npm run data:build -- --file data/results.csv
```

Writes `data/processed/elo-ratings.json`, `h2h-index.json`, and `playbook-chunks.json`.

### AI analyst

**Gemini** (cloud):

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_key
# optional: GEMINI_ANALYST_MODEL=gemini-2.5-flash-lite
```

**Ollama** (local):

```bash
LLM_PROVIDER=ollama
OLLAMA_MODEL=qwen2:7b   # or llama3.2, etc.
```

Skip AI on a request: `"include_llm": false` on `POST /api/analyze`.

### Polymarket odds

No key needed — fetched from Polymarket Gamma when a **home-win** market exists. Many friendlies have no market; gauges show 50% until odds appear.

## API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/matches` | GET | Match list + optional Polymarket prices (cached 5m) |
| `/api/analyze` | POST | Full breakdown for one fixture |

## Scripts

```bash
npm run data:build -- --file data/results.csv   # rebuild ratings + history
npm test
npm run typecheck
```

## Project layout

```
app/                      Dashboard UI
lib/alpha-engine.ts       Analysis pipeline
lib/live-fixtures.ts      Schedules + Polymarket enrichment
lib/elo.ts                Team strength ratings
lib/rag.ts                Past-match keyword search
lib/llm-analyst.ts        Optional AI estimate
data/processed/           Built ratings & history (committed)
data/bundled-fixtures.json Demo schedule when no live API token
```

## Verify real data

| What you see | Demo | Real |
|--------------|------|------|
| Schedule source | Sample / demo | Live match schedule |
| “From ratings” vs full estimate | Same | History + AI when enabled |
| Market gauge | No odds yet | Market odds |
| `elo-ratings.json` → `source` | `seed-ratings` | `csv:data/results.csv` |
