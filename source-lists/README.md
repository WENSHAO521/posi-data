# Source Lists

Raw, unmodified journal-title exports from publishers/consortia, uploaded
directly to this repo as the input for a cross-check/ingestion pass against
`corpus/global-benchmark.json`. Kept verbatim (not hand-edited) so the
provenance of any downstream fix or new record can be traced back to the
exact file that was crawled/parsed.

| File | Source | Rows | Used by |
|---|---|---|---|
| `jnlactive.csv` | Elsevier's own active-journals export (Full Title, ISSN, Unformatted ISSN, Product ID, Change History, Shortcut URL) | 3433 | `audits/data-quality/elsevier-website-fix-2026/`, `audits/migrations/elsevier-jnlactive-expansion-2026/` |
| `frontiers-titlelist-web-2026.csv` | Frontiers Media title list distributed via the Swiss Academic Libraries consortium ("Last update: 23.02.2026/AKO"); an 11-line preamble precedes the real `Journal,ISSN,URL` header | 234 (204 with a non-empty ISSN) | `audits/migrations/frontiers-expansion-2026/` |

Both are CSV but not uniformly shaped — always parse with
`posi-engine/src/showjcr/csv.mjs`'s `parseCsv()` (RFC4180-correct: handles
quoted fields containing commas, which `jnlactive.csv`'s titles do) rather
than a naive `split(',')`. For `frontiers-titlelist-web-2026.csv`, skip to
the real header line (`Journal,ISSN,URL`) before parsing — the file starts
with consortium metadata, not data.
