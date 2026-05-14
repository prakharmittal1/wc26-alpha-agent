# WC26 Alpha Agent

Autonomous agent that compares AI-derived true probabilities for World Cup 2026
matches against live Polymarket prices and surfaces mispriced contracts.

> **All four phases of the project spec are implemented.** Open
> `http://localhost:3000` after `npm run dev` for the full dashboard: a
> match grid, a streaming Alpha Feed, and a live Reasoning Log of the
> agent's tool calls.

## Stack

- **Next.js 16** (App Router, Turbopack, React 19) + Tailwind 4
- **Supabase** with `pgvector` for the RAG knowledge store
- **Vercel AI SDK** (`ai`, `@ai-sdk/google`) — embeddings now, `ToolLoopAgent`
  in Step 2
- **MCP** servers wired via [`.mcp.json`](./.mcp.json):
  [`mcp-football-server`](https://github.com/yalmeidarj/mcp-football-server)
  (API-Football) and
  [`prediction-mcp`](https://www.npmjs.com/package/prediction-mcp)
  (Polymarket + Kalshi). Runtime client wiring lives in Step 2.

## What's in this repo

```
app/
  api/chat/route.ts       Phase 3 POST endpoint: streams ToolLoopAgent output
  components/             Phase 4 dashboard React components
    Dashboard.tsx           Top-level client: useChat + match grid + chat + log
    MatchGrid.tsx           Clickable fixture cards
    ReasoningLog.tsx        Live tool-call event stream
    ProbabilityGauge.tsx    Pure-SVG semicircle gauge
  page.tsx                Renders <Dashboard /> with UPCOMING_FIXTURES
lib/
  agent/
    agent.ts              buildAgent() -> ToolLoopAgent with EV system prompt
    tools.ts              query_historical_data, get_team_sentiment, calculate_ev
    mcp.ts                Stdio MCP clients for football + prediction servers
  supabase/
    schema.sql            playbook_docs + sentiment_posts + sentiment_scores
    server.ts             Service-role client (runtime browser guard)
  embeddings.ts           Gemini gemini-embedding-001 @ 768 dims via embedMany
  reddit.ts               Paced RSS fetcher + Atom parser
  sentiment.ts            Gemini structured-output classifier
  teams.ts                Canonical WC 2026 team list + aliases
scripts/
  ingest.ts               Phase 1: Kaggle CSV → embeddings → Supabase upsert
  sentiment.ts            Phase 2: Reddit RSS → classify → per-team daily score
  agent-smoke.ts          Phase 3: run the agent against a prompt from the CLI
  README.md               How to download datasets + run each pipeline
.env.local.example        Required env vars
.mcp.json                 MCP server definitions for the IDE
data/                     Gitignored landing zone for Kaggle CSVs
```

## Quick start

```bash
npm install
cp .env.local.example .env.local
# Fill in GOOGLE_GENERATIVE_AI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

1. Create a Supabase project, then run [`lib/supabase/schema.sql`](./lib/supabase/schema.sql)
   in the SQL editor (or via `psql`).
2. Drop the Kaggle CSVs into `data/` — see
   [`scripts/README.md`](./scripts/README.md) for dataset URLs.
3. Ingest:

   ```bash
   npm run ingest -- --file data/results.csv --source international_results --limit 50
   ```

4. Boot the Next.js app:

   ```bash
   npm run dev
   ```

## The agent route

`POST /api/chat` takes `{ messages: UIMessage[] }` and streams the agent's
multi-step reasoning. Each request spawns the football + prediction MCP
servers, runs the loop (max 12 steps), and tears them down on stream
finish.

The agent has 5 categories of tools available:

| Name                       | Source            | Purpose                                                      |
| -------------------------- | ----------------- | ------------------------------------------------------------ |
| `query_historical_data`    | local (Phase 1)   | Vector search over `playbook_docs` via Gemini embeddings.    |
| `get_team_sentiment`       | local (Phase 2)   | Rolling Sent_d for a team over the last N days.              |
| `calculate_ev`             | local             | Deterministic EV math. p_true vs p_market, alpha threshold 0.05. |
| `football_*`               | mcp-football-server | Fixtures, injuries, lineups, etc. from API-Football.       |
| `prediction_*`             | prediction-mcp    | Polymarket + Kalshi market search and price lookup.          |

Every final message ends with a SUMMARY block: match, outcome, p_true,
p_market, edge, signal, ev_per_unit.

### Smoke-test from the CLI

```bash
# Construction only (no Gemini call):
MCP_DISABLED=1 npm run agent:smoke -- --prompt "ignored"   # will hit Gemini; set GOOGLE_GENERATIVE_AI_API_KEY first

# Full end-to-end (needs Gemini + RAPIDAPI keys for live MCP):
npm run agent:smoke -- --prompt "Should I take YES on Mexico beating USA in their next friendly?"
```

`MCP_DISABLED=1` skips the football + prediction MCPs entirely - useful when
working offline or before the API keys are filled.

## The dashboard (Phase 4)

`app/page.tsx` renders the `Dashboard` client component with a list of
upcoming fixtures from [`lib/fixtures.ts`](./lib/fixtures.ts) (stub data —
replace with a live fetch off the football MCP once you wire it in).

The Dashboard owns one `useChat<AgentUIMessage>()` hook from
`@ai-sdk/react` (default transport points at `/api/chat`) and renders:

- **Upcoming fixtures grid** - each card has a semicircle gauge for the
  current Polymarket YES price. Click any card to send a structured
  analysis prompt to the agent.
- **Alpha Feed** - the assistant's streaming text answer, with a
  `submitting` / `streaming` status indicator and a `stop` button.
- **Reasoning Log** - the live chain-of-thought sidebar. Each tool call
  the agent makes appears as an event with a state badge
  (`calling` / `running` / `ok` / `error`), its JSON input, and its JSON
  output once available. Auto-scrolls to the newest event.

Open the dashboard:

```bash
npm install
cp .env.local.example .env.local   # fill in keys
npm run dev                         # http://localhost:3000
```

The chat endpoint requires `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini). If
`RAPIDAPI_KEY` is set, the football MCP server is spawned per request; if
the prediction MCP server is reachable via `npx`, it is also spawned.
Either MCP failing only logs a warning - the agent still answers using
the local tools.

## Notes

- Service-role Supabase key is **server-only**. `lib/supabase/server.ts`
  has a runtime browser guard.
- `playbook_docs.doc_key` is a deterministic sha256 of the source row's
  primary-key fields, so re-running the ingest replaces rather than
  duplicates.
- `sentiment_scores.score` is a generated stored column implementing
  `(N_pos - N_neg) / (N_pos + N_neutral + N_neg + 3)` from the spec.
- MCP child processes are spawned per `/api/chat` request. First-call
  latency includes `npx -y mcp-football-server` install/start (~5-15s);
  subsequent calls reuse the npx cache.
