# Evidence ETL v1 — Core Collection Audit (31 journals)

Real run of `posi-engine`'s Evidence ETL pipeline against Core Collection.
**This is the third run** — pre-merge review caught that the first run's
100%/0-unknown result was a resolver bug, not a real finding. See
[audit-summary.md](./audit-summary.md) for the full story: what the bug
was, how the fix immediately found (and then correctly stopped flagging)
a real transient server error on three journals, and the final validated
results.

Short version: 31/31 journals resolved cleanly (100% site evidence
coverage) in this final run — and unlike the first run, this result
survived a resolver that is now unit-tested against the exact failure
scenario the bug produced. `met`/`not_met` totals (376/244 across 620
items) are unchanged from the first run, since matched content was never
affected by the bug — only the handling of unresolved cases was.

## Files

- `audit-summary.md` — full report, including the bug/fix narrative.
- `audit-summary.json` — machine-readable summary (final run).
- `per-journal-coverage.csv` — one row per journal.
- `path-hit-rate.csv` — per-candidate-path hit rate, for trimming
  `CANDIDATE_PATHS` before the 1000-journal run.

## What changed outside this directory

- `evidence/journals/<posi_id>.json` — 31 files, replaced with this final
  run's output (superseding the pre-fix results).
- `evidence/publishers/` — unchanged, still empty.

Nothing in `corpus/core-collection.json` changed — evidence collection
only, no AJR-E score computed or written. Companion posi-engine PR
(evidence-etl-v1 branch) has the resolver/fetch-layer/orchestrator fixes;
see its own commits for the two review-caught defects and the
relevance-mapping refinement found while investigating the fix's own
results.
