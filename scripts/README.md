# scripts/

## `data-build.ts` — Elo + head-to-head from Kaggle

Reads the international results CSV and writes:

- `data/processed/elo-ratings.json`
- `data/processed/h2h-index.json`
- `data/processed/playbook-chunks.json` (minimal keyword RAG)
- `data/bundled-fixtures.json` (demo schedule copy)

```bash
# Download CSV first — see README "Real data"
npm run data:build -- --file data/results.csv
```

Without a CSV, the script refreshes seed ratings only.
