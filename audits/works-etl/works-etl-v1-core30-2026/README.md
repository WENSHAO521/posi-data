# Article-Sample ETL v1 — Core Collection Audit (31 journals)

Real run of `posi-engine`'s new Article-Sample ETL pipeline
(`src/works-fetch.mjs` / `src/works-resolver.mjs`, orchestrated by
`scripts/run-works-etl.mjs`) against all 31 Core Collection journals,
2026-08-13.

## Why this pipeline exists

An earlier attempt to actually run `ajr-early-stage.mjs` (AJR-E-1.1) against
Core Collection found that `evidence-etl-v1-core30-2026` (this repo's
`audits/evidence-etl/`) only ever crawls a journal's own WEBSITE for
policy-disclosure text — it resolves exactly 21 criteria across Dimensions
1 (Editorial Governance), 2 (Research Integrity), and 7 (Transparency): 40
of AJR-E-1.1's 100 points. Dimensions 3 (Metadata & Digital
Infrastructure), 4 (Publishing Stability), 5 (Scholarly Output Quality
Signals), and 6 (Scholarly Reach & Concentration) — the other 60 points —
had **no data source anywhere in this repo**: no article-level
title/abstract/reference-count/license/author-identifier data existed for
any Core Collection journal. Computing a full AJR-E-1.1 score with that gap
unfilled would have meant fabricating roughly 60% of every score — exactly
the "claim more than was actually computed" failure this project already
had to walk back once (`audits/migrations/citation-preview-correction-2026/`).
This pipeline closes that gap with a real source (Crossref) instead of
filling it with invented values.

## Final numbers

```
Input journals:                 31
Journals with a usable ISSN:    31/31
Crossref 404 (no works registered under that ISSN): 1  (POSI-J-000030)
Total works fetched (all journals, all pages): 1,060

Article sample adequacy (AJR-E-1.1 minimum: 10, target: 30):
  Below minimum (10)  — Dimension 5 will score 0, "insufficient sample": 10/31
  At or above minimum, below target:                                     12/31
  Meets target (30):                                                      9/31

Infrastructure item statuses (Dimension 3, 31 journals):
  doi_resolution_reliability                met 30  unknown  1
  crossref_metadata_completeness            met 30  unknown  1
  abstract_reference_license_metadata       met 29  not_met 1  unknown 1
  structured_author_affiliation_identifiers met 10  not_met 20  unknown 1
  oai_pmh_schema_org_machine_readable       met 17  unknown 14
  digital_preservation_archiving            not_met 30  unknown 1

Cadence (Dimension 4) computable (periodic stated frequency + resolved launch date): 9/31
OAI-PMH endpoints checked (journal had oai_base_url on record): 20/31, of which 17 ok
```

The single `unknown`-across-the-board journal is `POSI-J-000030` (Digital
Intelligence Frontiers) — Crossref genuinely has no works registered under
its ISSN (`3135-0011`, HTTP 404). Its own corpus record already shows
`article_count: 0` and `months_since_launch: null`, consistent with a
journal that hasn't actually published yet. This is a real, honest zero,
not a resolver defect — every one of its evidence items resolves `unknown`
(untried/uncheckable), never a penalized `not_met`.

## Cross-check: fetched counts match the corpus's own `article_count`

Every journal's `works_fetched` in this run matches its corpus record's
`article_count` field exactly (e.g. `POSI-J-000001`: 40 and 40;
`POSI-J-000016`: 175 and 175) — a real, independent confirmation that this
pipeline is retrieving the actual, complete article set for each journal,
not a partial or mismatched one.

## `structured_author_affiliation_identifiers`: real, expected finding, not a bug

20 of 31 journals resolve `not_met` on this item — the majority of sampled
authors across this corpus have neither an ORCID nor a structured
affiliation string in their Crossref-deposited metadata. This is a genuine
metadata-completeness signal (small/new OJS journals commonly deposit bare
`given`/`family` names with no ORCID or affiliation to Crossref), not a
parsing gap — confirmed by spot-checking several `not_met` journals'
`evidence/works/<posi_id>.json#article_sample` directly.

## `digital_preservation_archiving`: real, expected finding, not a bug

30 of 31 journals (everything except the one with zero works) resolve
`not_met` — none of this corpus's sampled works carry Crossref's `archive`
field (CLOCKSS/Portico/LOCKSS registration). Small/new journals rarely have
third-party archiving set up yet; this is an honest finding about this
corpus's current archiving posture, not a detection failure.

## OAI-PMH: 3 of 20 checked endpoints hit a real, live timeout

`POSI-J-000026`, `POSI-J-000028`, `POSI-J-000029` — all three failed with a
network-level timeout (`http_status: null`, `error: "The operation was
aborted due to timeout"` / `"terminated"`), not a real "invalid OAI-PMH
response." Per `works-resolver.mjs`'s design, a network-level failure
resolves `unknown`, never `not_met` — these three journals' evidence items
are honestly marked "we don't know," not a false confident absence. Worth
a re-check alongside the Evidence ETL's already-documented
`ojs.shiharr.com` re-crawl recommendation (`audits/evidence-etl/evidence-etl-v1-core30-2026/`).

## `frequency_disclosed` (Dimension 4, weight 2) is NOT resolved by this run

See `evidence/works/README.md`'s own note — this is a website-crawl
question this pipeline deliberately does not answer, and the existing
Evidence ETL's `EVIDENCE_CRITERIA` list doesn't check it yet either. A
small, separate, still-open gap; not filled with a guess here.

## Cadence is genuinely uncomputable for most of this corpus

Only 9 of 31 journals have both a periodic stated `frequency` (`Monthly` /
`Bimonthly` / `Quarterly` / `Biannual` / `Annual`) and a resolved First
Regular Scholarly Publication Date. The other 22 are mostly `Continuous`
(15 journals corpus-wide) or `Irregular` (1) — frequencies this pipeline
deliberately treats as having no defined cadence to be judged against (see
`src/works-resolver.mjs`'s `FREQUENCY_WINDOW_MONTHS`, which excludes both
on purpose) — plus a handful of periodic-frequency journals still too
young for even one expected window. `computeCadenceScore()`
(`ajr-early-stage.mjs`) reads this as `null` ("not computable"), never a
failing `0`.

## Files

- `audit-summary.json` — machine-readable summary (matches the numbers
  above; generated directly by `scripts/run-works-etl.mjs`).
- `per-journal-coverage.csv` — one row per journal: ISSN queried, Crossref
  status, total results, works fetched, sample size/adequacy.

## What changed outside this directory

- `evidence/works/<posi_id>.json` — 31 new files (see
  `evidence/works/README.md` for the full package shape).
- `corpus/core-collection.json` — **unchanged.** This pipeline produces
  article-sample evidence only, the same separation-of-concerns
  `evidence-etl-v1-core30-2026` already established for site evidence.
  Computing and writing a real AJR-E-1.1 `early_stage_rating` (combining
  this evidence with `evidence/journals/`'s existing site evidence) is a
  later, separate step.
- `evidence/journals/` — unchanged, untouched by this run.

## Reproducibility

```
node scripts/run-works-etl.mjs \
  --corpus /path/to/posi-data/corpus/core-collection.json \
  --out <output dir> \
  --concurrency 3 --delay-ms 400 --doi-checks 10
```

Companion `posi-engine` PR has the fetch/resolver source and the full
commit history.

## Recommended next step

1. Re-check the 3 OAI-PMH timeouts and, ideally, extend `evidence-resolver.mjs`
   with a `frequency_disclosed` criterion so Dimension 4 stops carrying one
   permanently-`unknown` item.
2. With both `evidence/journals/` (Dimensions 1/2/7) and `evidence/works/`
   (Dimensions 3/4/5/6) now real for all 31 journals, a genuine end-to-end
   AJR-E-1.1 rerate becomes possible — still gated by each journal's real
   Evidence Coverage (some journals will land `not_rateable` on the
   framework's own mandatory-evidence bar, e.g. the 10 journals below the
   Dimension 5 minimum sample, or `POSI-J-000030` with zero Crossref
   works) rather than forced to a number regardless of coverage.
