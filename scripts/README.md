# scripts/

## `ingest.ts` — RAG knowledge bootstrap

Chunks the two Kaggle datasets named in the project spec, embeds each row with
Gemini (`gemini-embedding-001`, 768 dimensions), and upserts them into the
Supabase `playbook_docs` table.

### 1. Prereqs

1. `cp .env.local.example .env.local` in the project root and fill in:
   - `GOOGLE_GENERATIVE_AI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. In the Supabase SQL editor (or via `psql`), run
   [`lib/supabase/schema.sql`](../lib/supabase/schema.sql) to create the
   `playbook_docs` table, indexes, and the `match_playbook_docs` RPC.
3. Install deps from the project root: `npm install`.

### 2. Download the Kaggle CSVs into `data/`

The `data/` folder is gitignored (large files, redistribute via Kaggle).

| Source name (`--source`)   | Suggested file path                | Kaggle dataset                                                              |
| -------------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| `international_results`    | `data/results.csv`                 | `martj42/international-football-results-from-1872-to-2017`                  |
| `wc2026_probabilities`     | `data/wc2026_probabilities.csv`    | The "World Cup 2026 Match Probability" dataset referenced in the project spec |

Using the Kaggle CLI (`pip install kaggle` and place an API token at
`~/.kaggle/kaggle.json`):

```bash
kaggle datasets download -d martj42/international-football-results-from-1872-to-2017 -p data --unzip
# rename / move the per-dataset CSV inside data/ as needed so the filenames
# below match.
```

### 3. Run the ingest

Smoke test first (limit 50 rows):

```bash
npm run ingest -- --file data/results.csv --source international_results --limit 50
```

Then full ingest for each source:

```bash
npm run ingest -- --file data/results.csv --source international_results
npm run ingest -- --file data/wc2026_probabilities.csv --source wc2026_probabilities
```

The script is **idempotent**: each row gets a deterministic `doc_key`
(sha256 of source + primary-key fields), and the upsert uses
`ON CONFLICT (doc_key) DO UPDATE`, so re-runs replace rather than duplicate.

### 4. What's plugged in next (Step 2)

Step 2 will add `app/api/chat/route.ts` with a `ToolLoopAgent`. One of its
tools, `query_historical_data`, will call the `match_playbook_docs` Postgres
function created by `schema.sql`, embedding the agent's query with
`embedQuery` from [`lib/embeddings.ts`](../lib/embeddings.ts).

---

## `sentiment.ts` — Reddit RSS sentiment pipeline (Phase 2)

Pulls public Reddit RSS feeds (no API key), classifies each post with Gemini,
extracts the WC 2026 teams it concerns, and rolls everything up into a
per-(team, date) score via the spec's smoothed formula:

`Sent_d = (N_pos - N_neg) / (N_pos + N_neutral + N_neg + 3)`

### Prereqs (in addition to the ingest prereqs above)

- Re-apply [`lib/supabase/schema.sql`](../lib/supabase/schema.sql) — it now
  also creates `sentiment_posts`, `sentiment_scores`, and the
  `refresh_sentiment_scores` RPC. Safe to re-run.
- The script honors Reddit's rate-limit etiquette: it identifies itself with
  a real User-Agent, hits `old.reddit.com`, and sleeps 1.5s between feeds.
  Don't fan out parallel runs.

### Run

```bash
# See options
npm run sentiment -- --help

# Dry-run against r/soccer (no DB writes; prints 5 sample classifications)
npm run sentiment -- --subreddits soccer --max-per-sub 25 --dry-run

# Real run over the default subreddit list, last 24h only
npm run sentiment -- --since-days 1
```

The script is idempotent: posts are upserted on Reddit's stable `t3_xxx`
fullname, and the `refresh_sentiment_scores` RPC rewrites the affected
`(team, date)` slice each run.

### Tuning the model

Set `GEMINI_SENTIMENT_MODEL` in `.env.local` to swap the classifier (default
`gemini-2.5-pro`). 1.5 Pro is sunset; any 2.x Pro model works.
