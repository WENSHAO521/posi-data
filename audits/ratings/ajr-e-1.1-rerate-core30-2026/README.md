# AJR-E-1.1 Rerate — Core Collection (31 journals)

The real, first-ever run of AJR-E-1.1 (`posi-engine`'s `src/ajr-early-stage.mjs`,
implemented and unit-tested for several PRs but never previously run
against real data) against all 31 Core Collection journals, 2026-08-14.
Produced by `posi-engine`'s `src/ajr-e-rerate.mjs` /
`scripts/rerate-core-collection-ajr-e-1.1.mjs`, combining the two evidence
sources this project now has: `evidence/journals/` (site-crawl, Dimensions
1/2/7) and `evidence/works/` (Crossref article-sample, Dimensions 3/4/5/6 —
`audits/works-etl/works-etl-v1-core30-2026/`).

## Headline numbers

```
Input journals:                          31
Currently Early-Stage lifecycle stage:   10   (LIFECYCLE-1.1 exact-date boundary, recomputed at rating time)
  official                                6
  provisional                             2
  not_rateable                            2
Currently Observation or unknown stage:  21   (not_applicable -- AJR-E does not apply right now)
E-Q quartile assigned:                    0   (structurally correct, see below -- not a bug)
```

## Why only 10 of 31 were even attempted

AJR-E applies to the **Early-Stage** lifecycle window (12–59 months since
first regular scholarly publication), decided by exact date-boundary
arithmetic (LIFECYCLE-1.1, `posi-engine/src/lifecycle.mjs`), never by a
prior rating's stored stage label. Re-deriving every journal's stage as of
today found:

- **10 journals are genuinely Early-Stage today**: `POSI-J-000001`,
  `000003`, `000006`, `000013`, `000014`, `000015`, `000016`, `000017`,
  `000018`, `000029`.
- **19 journals are currently Observation** (under 12 months old) or have
  an unresolved lifecycle (`POSI-J-000030`, `POSI-J-023332` — no first-
  publication date on record). AJR-E genuinely does not apply to any of
  them right now — `rating_status: "not_applicable"`, no score attempted,
  no score forced.

**Real finding, not a rerun artifact**: two journals that carried a real,
non-null `AJR-E-1.0` total (`POSI-J-000009`: 87, `POSI-J-000026`: 56) are
now `not_applicable` — under LIFECYCLE-1.1's exact-date check they are only
9 and 11 months old respectively as of 2026-08-14, i.e. still in
**Observation**, not Early-Stage. Their 1.0 rating was computed under
whatever stage-classification logic the prior (website-repo,
`scripts/rate-early-stage.mjs`) pipeline used, which this framework
overhaul's `LIFECYCLE-1.1` fix (posi-data/CHANGELOG.md) was specifically
built to correct — a real illustration of the boundary bug LIFECYCLE-1.1
targets, not something invented for this rerate.

## The 10 Early-Stage journals, in detail

| POSI ID | AJR-E-1.0 total | AJR-E-1.1 total | Δ | 1.1 rating_status | 1.1 evidence coverage | Why (if not `official`) |
|---|---:|---:|---:|---|---:|---|
| POSI-J-000001 | 83 | 80.87 | -2.13 | official | 96.55% | |
| POSI-J-000003 | 84 | 85.72 | +1.72 | official | 96.55% | |
| POSI-J-000006 | n/a | — | — | **not_rateable** | 93.1% | article sample of 4 < AJR-E-1.1's minimum of 10 |
| POSI-J-000013 | 76 | 75.26 | -0.74 | official | 93.1% | |
| POSI-J-000014 | 44 | 64.92 | **+20.92** | official | 93.1% | |
| POSI-J-000015 | 72 | 67.37 | -4.63 | official | 93.1% | |
| POSI-J-000016 | 50 | — | — | **not_rateable** | 56.9% | site evidence coverage 56.9% < 60% (the documented `ojs.shiharr.com` finding, `audits/evidence-etl/evidence-etl-v1-core30-2026/`) |
| POSI-J-000017 | 73 | 82.27 | +9.27 | provisional | 65.52% | real score, shown, but coverage 60-79.9% keeps it out of E-Q ranking per the framework's own rule |
| POSI-J-000018 | 67 | 81.14 | +14.14 | provisional | 62.07% | same as above |
| POSI-J-000029 | 65 | 58.45 | -6.55 | official | 93.1% | |

Mean delta across the 8 journals with both a real 1.0 and a real 1.1 total:
**+4.0**, but that average hides a wide spread (-6.55 to +20.92) — see the
per-dimension sanity check below for why.

## Sanity-checking the swings against the two documented 1.0→1.1 bug fixes

Spot-checked `POSI-J-000001` and `POSI-J-000014` dimension-by-dimension
(full detail in `per-journal-comparison.csv` / the corpus diff itself):

**`POSI-J-000014` (+20.92, the largest swing)** — driven almost entirely by
Dimension 5 (Scholarly Output Quality Signals): `soc` went from `0` (1.0)
to `17.8`/20 (1.1). This is the direct, expected effect of this project's
own recent work: **no real article-sample data existed anywhere for this
pipeline before the Article-Sample ETL** (`audits/works-etl/`), so
Dimension 5 had nothing to score against before now. `inf` (Infrastructure)
rose `4 → 10.38` — consistent with **bug fix #2** (no more flat "+4 if
OpenAlex Source exists" bonus): the real infrastructure evidence
(DOI resolution, Crossref metadata completeness, abstract/reference/
license presence) legitimately supports a higher score than the old
bonus-inflated number once actually checked.

**`POSI-J-000001` (-2.13, a real journal with 100% site coverage)** —
`rif` (Research Integrity) rose `12 → 14` (this journal has real,
independently-evidenced Authorship and COI policies — **bug fix #1**
removed the auto-credit, but this journal doesn't need it, it has the real
evidence). `inf` rose `8 → 11` (same reasoning as above). `pub` (Publishing
Stability) dropped `15 → 9.5` and `trn` (Transparency) dropped
`10 → 6.67` — both explained by real, expected gaps: `pub` loses up to 2
points because `frequency_disclosed` is deliberately left `unknown` by
this pipeline (see `evidence/works/README.md`'s own note — a website-crawl
question, not resolved yet by either ETL); `trn` reflects real `not_met`
findings on items like `advertising_sponsorship_disclosure`, which the
Evidence ETL audit already found `not_met` for the large majority of Core
Collection journals (`audits/evidence-etl/evidence-etl-v1-core30-2026/`:
2 met / 19 not_met / 10 unknown corpus-wide).

**Conclusion: every swing traced is explainable by a specific, documented
cause (a real bug fix, or newly-available real data) — none look like a
resolver defect.**

## Why zero journals got an E-Q quartile — structurally correct, not a bug

E-Q ranking (`posi-engine/src/cohort.mjs`/`quartile-tracks.mjs`,
unmodified by this rerate) requires:

1. Only `official`-status scores are ranking-eligible at all (AJR-SPEC.md
   § 6: a `provisional` score is shown but explicitly "not eligible for
   ranking/quartile"). That pool is **6** journals here.
2. Within that pool, only `psc_confidence: "high"` or `"verified"`
   journals may enter a cohort (`cohort.mjs`'s confidence gate). Across
   all 31 Core Collection journals, only **7** carry `psc_confidence:
   "high"` — none are `"verified"` (human-confirmed) yet.
3. A cohort still needs PSC L3≥20, else L2≥20, else L1≥30 members.

Even in the best case (all 6 officially-rated journals happened to share
one high-confidence PSC category), 6 is far short of every threshold in
the fallback chain (20 at L2/L3, 30 at L1). **No E-Q cohort can
mathematically form from Core Collection alone at its current size and PSC
classification coverage** — every rated journal correctly shows
`quartile: null`, `ranking_method: "unavailable"`, its score still shown
(AJR-SPEC.md § 5: "the score is still shown ... never forced"). This will
change as the corpus grows and more journals get `high`/`verified` PSC
classification — nothing here needs fixing to make that happen.

## What's still a known, open gap (not fabricated, not silently assumed)

- **`frequency_disclosed`** (Dimension 4, weight 2) is `unknown` for every
  journal — a website-crawl question neither ETL resolves yet (see
  `evidence/works/README.md`). Structurally caps every journal's
  achievable Evidence Coverage below 100% (max observed: 96.55%), never
  below the `official` threshold on its own.
- **"Absence of a known severe integrity issue"** (part of AJR-SPEC.md §
  6's mandatory-evidence bar) is treated as trivially satisfied — no
  citation-integrity review pipeline exists for Early-Stage journals in
  this codebase yet (`citation-integrity.mjs` targets AJR-M's accumulated
  citation history). Documented in `ajr-e-rerate.mjs`'s
  `determineMandatoryEvidenceResolved()` header rather than silently
  assumed.
- **Overall Evidence Coverage %** shown per journal here is a blend of
  Dimensions 1/2/3/7 plus Dimension 4's two disclosure items only — a
  documented scope decision (`ajr-e-rerate.mjs`'s
  `aggregateOverallEvidenceCoverage()`), since Dimension 4's cadence/
  continuity/output sub-scores and all of Dimensions 5/6 are direct
  numeric computations, not Met/NotMet evidence items, and were never part
  of the Evidence Coverage formula to begin with.

## Files

- `audit-summary.json` — machine-readable summary.
- `per-journal-comparison.csv` — one row per journal: old 1.0 total,
  1.0 eligibility, new lifecycle stage, new rating_status, new 1.1 total,
  delta, evidence coverage, quartile label, not-rateable reason.

## What changed outside this directory

- `corpus/core-collection.json` — every one of the 31 journals'
  `early_stage_rating` object replaced with this rerate's output (version
  `AJR-E-1.1`). Nothing else on any journal record changed.

## Reproducibility

```
node scripts/rerate-core-collection-ajr-e-1.1.mjs \
  --corpus /path/to/posi-data/corpus/core-collection.json \
  --evidence-journals /path/to/posi-data/evidence/journals \
  --evidence-works /path/to/posi-data/evidence/works \
  --out-corpus <path> --out-report <dir> \
  --rating-date 2026-08-14
```

Companion `posi-engine` PR has `src/ajr-e-rerate.mjs` and
`scripts/rerate-core-collection-ajr-e-1.1.mjs`.

## Recommended next step

1. Add a `frequency_disclosed` criterion to `evidence-resolver.mjs` to
   close that specific, small, known gap.
2. Re-crawl the `ojs.shiharr.com`-hosted journals (`POSI-J-000016`'s
   coverage is depressed by the same host issue documented in
   `audits/evidence-etl/evidence-etl-v1-core30-2026/`) and re-run this
   rerate for that journal specifically.
3. As more Core Collection / Global Benchmark journals get `high`/
   `verified` PSC classification and cross the Early-Stage boundary, E-Q
   cohorts will start forming on their own — no pipeline change needed.
