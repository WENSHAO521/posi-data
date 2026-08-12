# Benchmark Citation Q — 2026

Computes a *provisional* Citation Q ranking for the 3296 Global Benchmark
journals bulk-ingested by the Elsevier/Frontiers expansions (2026-08-12 —
see `audits/migrations/elsevier-jnlactive-expansion-2026/` and
`audits/migrations/frontiers-expansion-2026/`), which previously had
`early_stage_rating: null` and no PSC classification at all.

## What this deliberately does NOT do

**No full AJR-M score is computed.** AJR-M is 100 points, and 65 of those
(Editorial Governance, Metadata/Infrastructure, Reach, Transparency) need
the same Evidence Coverage web-crawl used for the Core Collection —
which only succeeded on ~9–22% of journals even at 31–600-journal scale,
specifically because major-publisher platforms (Elsevier, Wiley — most of
this pool) block ~73% of requests (see
`audits/evidence-etl/evidence-etl-v1-core30-2026/`). Running that crawl
across ~3300 journals would mostly fail rather than produce real scores,
so it was not attempted. `early_stage_rating` (reserved for a real,
evidence-based AJR-E/AJR-M score) is left untouched — `null` — on every
record this migration processed.

**The citation figure is provisional, not official PCI**, exactly
matching the website's own existing `/citation-reports` page's framing
for the Core Collection: OpenAlex's `summary_stats.2yr_mean_citedness`,
taken as-is. Real PCI needs a formal PJR release (PJR-SPEC.md), which
hasn't happened for Core Collection either yet — this migration does not
invent a lighter PJR release process just for these journals.

## What IS computed

Per journal (single OpenAlex singleton source lookup —
`select=id,works_count,summary_stats,counts_by_year,topics`):

- **PSC classification** — `psc-classify.mjs`'s `classifyPsc()`, unchanged
  from what Core Collection uses, fed OpenAlex's own `topics` array.
- **Lifecycle bucket** (`mature` / `not_yet_mature`) — NOT the real
  FPD-1.0/LIFECYCLE-1.1 methodology (which needs an actual first-
  publication-date resolution). Instead: a journal is bucketed `mature`
  only if OpenAlex's `counts_by_year` shows real, checkable evidence of
  publishing activity ≥5 years before this run (2026) — at least one
  year with `works_count > 0`. Absence of such evidence buckets a journal
  `not_yet_mature`, conservatively, per POSI's own "unknown is not the
  favorable case" principle — never assumed mature from missing data.
- **Citation Q** — `quartile-tracks.mjs`'s `rankCitationTrack()` (a thin
  wrapper on `ranking.mjs`'s existing `rankCategory()`, `MIN_CATEGORY_SIZE
  = 20`, no L1 fallback — unchanged, the same function real PCI-based
  Citation Q will use once official). Only journals that are `mature` +
  `psc_confidence: 'high'` are cohort-eligible, grouped by `psc_category`
  directly (26 categories formed).

## Result

```
Candidates (no early_stage_rating):                    3296
OpenAlex fetch errors (no source id / lookup failed):    -51
Classified:                                             3245

  Ranked with a real Citation Q quartile:                2614
  Classified + mature, cohort < 20 (ranking unavailable):  58
  Mature but unclassified / low PSC confidence:            23
  Not yet mature (moved to Early-Stage benchmark section): 550
```

2614 + 58 + 23 + 550 + 51 = 3296. Fully accounted for.

## A bug caught during this run — diagnostics only, not the data

The first full run's own summary.json reported `"ranked_with_quartile":
0`, which looked alarming (971 journals alone landed in one category well
over the size-20 threshold). Investigated before trusting the number:
`ranking.mjs`'s `rankCategory()` labels a successful ranking
`ranking_method: 'pci_midrank'`, but this migration's summary-stats code
checked for the wrong string (`'score_midrank'`, copied from a different
function's convention in `quartile-tracks.mjs`). Verified directly against
the real output file (`results-by-journal-code.json`) that 2614 journals
already had complete, correctly-computed `quartile`/`percentile`/`rank`
values — the underlying computation was never wrong, only this run's own
diagnostic count. Fixed the script and regenerated summary.json from the
existing (correct) results without re-fetching anything.

## Files

- `citation-ratings.csv` — all 3245 classified records (posi_id, title,
  PSC category/confidence, lifecycle bucket, provisional citation figure,
  Citation Q label, percentile).
- `summary.json` — the reconciled counts above.

## Reproducibility

```
node posi-engine/scripts/compute-benchmark-citation-q-2026.mjs \
  --benchmark corpus/global-benchmark.json \
  --cache-dir <dir> --out <dir> --concurrency 10
```

Every OpenAlex response is disk-cached keyed by request signature — an
interrupted run resumes without re-querying anything already fetched.

## What this does NOT do

- Does not touch Core Collection.
- Does not run PSC classification against the 993-record curated seed
  (those already have `early_stage_rating` and are untouched by this
  script's candidate filter).
- Does not compute PCI-5 or PNCI (both need the heavier per-work fetch
  `fetch-pjr-source-data.mjs` implements for the real PJR pipeline).
- Does not cut a PJR release or write to `journals/`, `metrics/`, or
  `rankings/`.
