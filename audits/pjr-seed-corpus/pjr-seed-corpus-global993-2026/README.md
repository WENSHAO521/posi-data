# PJR Seed Corpus — PCI ETL v1 (993 curated Global Benchmark journals)

Real run of `posi-engine`'s PCI/PCI-5 data-acquisition and calculation
pipeline (`scripts/fetch-pjr-source-data.mjs` + `src/pci.mjs`) against the
993-journal curated Global Benchmark seed (`corpus/global-benchmark.json`,
entries with no `source_note` — the same curated seed PCS's own
`pcs-etl-v1-core30-2026`/`pcs-etl-v1-global1024-2026` runs used before
PCS was later extended to the full 4289-journal publisher-catalog
expansion). Run 2026-08-15, OpenAlex-sourced, via a paid OpenAlex API key
(the `/works` filtered-list endpoint this pipeline depends on now requires
one — a free-tier polite-pool `mailto=` request alone returns nothing
useful for it).

**Scope note:** this run originally covered Global Benchmark only, not
POSI's own Core Collection — a same-day spot-check found 28 of 30
resolvable Core Collection journals had zero indexed works in the
2023-2024 PCI window at all, since Core Collection is overwhelmingly
young (Early-Stage lifecycle, most first published 2025-2026). Global
Benchmark's established, long-running journals were chosen instead
specifically to validate the pipeline against a corpus where PCI has
something real to measure.

**2026-08-15 update — Core Collection added.** Same run, same fixed
pipeline, extended to all 30 resolvable Core Collection journals: 2 of
them (`jcsis`, `jmss`) do have real, non-zero 2023-2024 output and now
have a computed PCI. The other 28 remain `pci: null` (zero eligible
items — a real, checked outcome, not a fabricated reason). Both
`journals_with_pci_computed` and the totals in `audit-summary.json` now
reflect Core Collection + Global Benchmark combined (992 of 1,023).

**Citation Q is now real for exactly 2 Core Collection journals.**
PJR-SPEC.md § 8's `MIN_CATEGORY_SIZE = 20` gate (posi-engine's
`ranking.mjs`) needs at least 20 metric-eligible, high-confidence-PSC
journals in a category before any quartile is assigned. Core Collection
alone can never reach that (31 journals spread across many categories) —
but pooling Core Collection's high-confidence-PSC, real-PCI journals with
Global Benchmark's (989 of them, `psc_confidence: "high"`) as the ranking
peer group is mathematically valid per the spec's own wording ("rank all
metric_eligible journals" in a category — not "rank only Core
Collection"), and does not change Global Benchmark's own display status
(the site's existing "no Citation Rank/Percentile/Quartile shown for
Global Benchmark" rule is about *display*, not about whether those
journals count toward a category's peer pool). Verified: `jcsis`
(category P5.02, category_size 68, PCI 2.5) ranks Citation Q4, 22.8th
percentile; `jmss` (same category, PCI 1.0) ranks Citation Q4, 4.4th
percentile. The remaining 28 Core Collection journals are still
`ranking_method: "unavailable"` — either no real PCI to rank by, or
`psc_confidence: "low"` (22 of 31), which the pipeline gates on
independently of PCI availability (`run-pjr-seed-pipeline.mjs`'s
`m.confidence !== 'high'` check).

## Final numbers (real OpenAlex data)

```
Input journals:                                    993  (curated Global Benchmark seed, no source_note)
Journals resolved to a posi_id:                 993/993
Journals with a real, non-null 2-year PCI:      990/993  (3 journals: zero eligible items in the 2023-2024 window)
Journals with an EXACT (uncapped) 2yr numerator: 993/993
Journals with PCI-5's older-tail capped:            346  (secondary metric only -- see "A real bug" below)

Total citable items (2yr, all journals):      1,994,613
Total citation_count (2yr, all journals):    11,681,576
Pooled mean PCI (2yr), weighted by volume:         5.86
Unweighted distribution across the 990 computed:  min 0.49, median 3.75, max 53.09
```

Highest real 2-year PCI values found in this run include Nature Genetics
(~19.5), Journal of the American Chemical Society (18.22, 6,616 eligible
items), and several other high-impact, review-heavy titles — the same
shape of result PCS's own audit found for its citation indicator: a
handful of high-impact-review journals with high per-article citation
rates sit at the top, exactly what a real citation indicator should
produce, not an artifact.

## A real bug, found and fixed mid-run

`fetch-pjr-source-data.mjs`'s original version paged through a single
mixed 5-year window (metric_year-5..metric_year-1) capped at `--max-pages`
(default 10, 2,000 works), then filtered that same capped set down to the
2-year PCI window. For any journal whose 2-year citable-item count alone
exceeded the cap — e.g. Journal of the American Chemical Society, 6,616
real citable items in 2023-2024 against a 2,000-work default cap — the
"real" PCI ended up computed from a partial, most-recent-first-biased
subset instead of the true population. This wasn't a hypothetical: a
same-day 31-journal spot-check found 15/31 sampled journals affected, and
JACS's own PCI moved from an artificially low 15.01 (partial sample) to
its true 18.22 once fixed.

Fixed by splitting the fetch into two independent passes per journal: the
2-year PCI window is now fetched **exhaustively** (uncapped except for a
500-page/100,000-work defensive backstop — see
`EXHAUSTIVE_PAGE_CEILING`'s own doc comment in `fetch-pjr-source-data.mjs`,
never expected to bind for any real journal), while only PCI-5's older
3-year tail (metric_year-5..metric_year-3, which the schema and
`PJR-SPEC.md` already tolerate an estimated numerator for) stays capped.
Verified against the full 993-journal run: 993/993 journals now have an
exact, uncapped 2-year numerator (`pci_citable_items` in each record
exactly matches OpenAlex's own reported count for that window), with only
the secondary PCI-5 metric affected by any cap (346/993).

A second issue surfaced only at full scale: writing all 993 journals'
raw fetched works (including full `counts_by_year` arrays for
high-volume journals) into a single `JSON.stringify()` call produced a
~650MB combined string, exceeding V8's max string length
(`RangeError: Invalid string length`) after a real, ~74-minute,
budget-spending fetch had already completed successfully. Fixed by
streaming output as NDJSON (one journal per line, written incrementally
via a write stream) instead of building one combined JSON document —
the completed fetch was recovered from its on-disk response cache
(no data lost, no re-fetch, no additional API budget spent) by re-running
the same command against the same `--cache-dir`.

## What this is not

**Not a POSI-R release, not PNCI.** This run computes PCI and PCI-5 only.
PNCI (POSI Normalized Citation Indicator — a journal's PCI divided by its
primary PSC category's pooled expected rate, `calculateCategoryBaseline()`/
`calculatePnci()` in `src/pci.mjs`) needs every metric-eligible journal in
a category computed together to form that category's baseline, which this
run's Global-Benchmark-only scope does not attempt — deferred to a
follow-up run. No `POSI-R-*` release exists yet (see
`POSI-R-1.0-SPEC.md`); this is real, computed data published as a
pre-release snapshot, same status as PCS's own audits before it.

**Data location.** Per-journal records live at
`pci/<shard>/<posi_id>.json` (256-shard layout, `src/sharding.mjs`'s
`shardFor()` convention), one entry per journal that resolved a
`posi_id` — there is no posi-engine release workflow yet that writes PCI
into `metrics/<year>/<shard>/` (`CONTRIBUTING.md` restricts that path to a
release workflow that doesn't exist), so this audit directory is read
directly by `posi-data-delivery`'s `publish-data-snapshot.mjs`, the same
pattern PCS already established.
