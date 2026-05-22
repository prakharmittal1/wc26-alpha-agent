# scripts/

| Script | Command | Output |
|--------|---------|--------|
| `data-build.ts` | `npm run data:build -- --file data/results.csv` | `data/processed/elo-ratings.json`, `h2h-index.json`, `playbook-chunks.json` |
| `build-wc26-venues.ts` | `npm run wc26:venues` | `data/wc26-match-venues.json` |
| `sentiment-ingest.ts` | `npm run sentiment:ingest` | News headline cache (`data/processed/sentiment-cache/`) |

See the root [README](../README.md) for setup and API keys (use a local `.env.local`, not committed).
