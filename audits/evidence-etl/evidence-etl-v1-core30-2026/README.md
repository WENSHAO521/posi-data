# Evidence ETL v1 — Core Collection Audit (31 journals)

First real run of `posi-engine`'s Evidence ETL pipeline, against Core
Collection. See [audit-summary.md](./audit-summary.md) for the full
writeup: coverage distribution, per-criterion met/not_met breakdown,
per-candidate-path hit rate, and what to change before scaling to the
1000-journal Global Benchmark Collection.

Short version: 31/31 journals resolved cleanly (100% Evidence Coverage,
`official` rating eligibility), 0 blocked/unknown/conflicted/stale items —
explainable (well-maintained OJS sites, no bot-blocking encountered), but
means this run doesn't yet validate the blocked/403 handling path. The
met/not_met split (376/244 across 620 items) shows real per-criterion
variance, not rubber-stamping, and bilingual (EN/CN) content matching was
spot-verified against a real Chinese-language journal.

## Files

- `audit-summary.md` — full report.
- `audit-summary.json` — machine-readable summary (same shape the
  orchestrator script prints).
- `per-journal-coverage.csv` — one row per journal: coverage %, rating
  eligibility, pages fetched.
- `path-hit-rate.csv` — per-candidate-path hit rate across the 31
  journals, for trimming `CANDIDATE_PATHS` before the next run.

## What changed outside this directory

- `evidence/journals/<posi_id>.json` — new, 31 files, one evidence
  package per Core Collection journal.
- `evidence/publishers/` — new, empty (see `evidence/README.md`).
- `evidence/README.md` — new, explains the whole evidence system.

Nothing in `corpus/core-collection.json` changed — this PR is evidence
collection only, no AJR-E score computed or written.
