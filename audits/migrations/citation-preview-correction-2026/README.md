# Citation preview correction — 2026-08-13

Withdraws the `citation_rating.citation_q.{rank,percentile,quartile}`
output produced by `audits/migrations/benchmark-citation-q-2026/`
(2026-08-12) and replaces it with an explicitly diagnostic-only
`citation_preview` object, on every one of the 3,245 Global Benchmark
records that migration touched.

## Why

That migration fed OpenAlex's `summary_stats.2yr_mean_citedness` into
`posi-engine/src/quartile-tracks.mjs`'s `rankCitationTrack()` — the same
production ranking function real Citation Q uses — producing a genuine
`quartile`/`percentile`/`rank` for 2,614 of the 3,245 classified journals.
This conflicts with two already-frozen rules:

1. **AJR-SPEC.md § 14** ("Global Benchmark membership does not determine
   ranking eligibility"): real ranking eligibility requires collection
   eligibility + lifecycle determination + PSC `high`/`verified`
   confidence + **Evidence Coverage eligibility** + a real cohort gate.
   The prior migration's `mature` bucket is an admitted heuristic
   (`counts_by_year` shows activity ≥5 years back — not the real
   FPD-1.0/LIFECYCLE-1.1 determination), and no Evidence Coverage crawl
   ran at all (by design — see the superseded audit's own "What this
   deliberately does NOT do" section).
2. **`rankCitationTrack()`'s own contract**: `{ journal_id, pci }`. PCI is
   POSI's own citable-items/citation-window calculation (PJR-SPEC.md
   § 5-6) — a fundamentally different number from OpenAlex's
   `2yr_mean_citedness`. Labeling the OpenAlex figure's rank/percentile
   "Citation Q1–4" borrowed the real metric's name for a different
   number that was never gated for ranking eligibility.

## What changed

For every record in `corpus/global-benchmark.json` carrying a
`citation_rating` field (3,245 of 4,289), the field was renamed to
`citation_preview` and restructured in place — **no new OpenAlex fetch,
no recomputation** — this is a pure relabel/downgrade of already-fetched
data, not a rerun:

```diff
- "citation_rating": {
-   "psc_category": "P3.02",
-   "psc_confidence": "high",
-   "lifecycle_bucket": "mature",
-   "two_yr_mean_citedness": 1.8585858585858586,
-   "h_index": 20,
-   "works_count": 921,
-   "citation_q": {
-     "quartile": "Q2",
-     "quartile_label": "Citation Q2",
-     "percentile": 62.67,
-     "rank": 363,
-     "cohort_size": 971,
-     "ranking_method": "pci_midrank",
-     "category_code": "P3.02"
-   },
-   "rated_at": "2026-08-12",
-   "version": "CITATION-Q-PROVISIONAL-1.0",
-   "source_note": "Provisional -- OpenAlex 2yr mean citedness, not yet official PJR PCI. See /citation-reports."
- }
+ "citation_preview": {
+   "source": "OpenAlex",
+   "metric": "2yr_mean_citedness",
+   "value": 1.8585858585858586,
+   "h_index": 20,
+   "works_count": 921,
+   "psc_category": "P3.02",
+   "psc_confidence": "high",
+   "history_evidence": { "has_activity_5y_ago": true },
+   "rank": null,
+   "percentile": null,
+   "quartile": null,
+   "status": "diagnostic_only",
+   "rated_at": "2026-08-12",
+   "version": "CITATION-PREVIEW-1.0",
+   "source_note": "Diagnostic preview only -- OpenAlex 2yr mean citedness, not PCI. Not ranked, not Citation Q, not used for any POSI ranking or eligibility decision."
+ }
```

`rated_at` is preserved from the original run (the underlying OpenAlex
figure wasn't re-fetched, so its collection date didn't change).
`lifecycle_bucket` is renamed to `history_evidence.has_activity_5y_ago` —
same boolean, framed as raw evidence rather than a lifecycle-stage
assignment (POSI does not have a `lifecycle_bucket` concept anywhere
else in its schema; this migration's own naming was the source of the
confusion, alongside the ranking issue above).

No record's `early_stage_rating`, `psc_category` (top-level), or any
other field was touched — this migration only rewrites the
`citation_rating`/`citation_preview` key.

## Result

```
Total Global Benchmark records:               4289
Records with citation_rating (transformed):    3245
Records without citation_rating (untouched):   1044

Post-transform verification:
  citation_preview present:                    3245
  citation_rating still present (bug if > 0):     0
  citation_q anywhere (bug if > 0):                0
  status !== "diagnostic_only" (bug if > 0):       0
  rank/percentile/quartile non-null (bug if > 0):  0
```

## Companion changes (same rollout, separate repos)

- **posi-engine** (`methodology-integrity-hotfix-2026` branch, PR #9):
  `compute-benchmark-citation-q-2026.mjs` renamed/rewritten to
  `compute-benchmark-citation-preview-2026.mjs` — the same OpenAlex fetch
  + PSC classification + lifecycle heuristic, but no cohort grouping and
  no `rankCategory()`/`rankCitationTrack()` call at all, so any *future*
  run of this script for newly-added Global Benchmark journals produces
  the corrected shape from the start.
- **website** (`frontend-methodology-alignment-2026`, separate PR):
  updates `/citation-reports`, `src/lib/types.ts`, `CitationReportsTable`,
  `LifecycleRatingsTable`, and `publisher-catalog-client.ts` to read
  `citation_preview` instead of `citation_rating.citation_q` and stop
  displaying rank/percentile/quartile for Global Benchmark journals.

## Reproducibility

This was a pure in-place JSON transform (rename + restructure one
existing field per record), not a script kept in the repo — the
transform logic is fully specified by the before/after diff above. A
future re-run of `compute-benchmark-citation-preview-2026.mjs` (e.g. for
newly-ingested Global Benchmark journals) writes the corrected shape
natively; no transform step will be needed for new data going forward.
