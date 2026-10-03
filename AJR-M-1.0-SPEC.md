# AJR-M 1.0 — POSI Automated Journal Rating, Mature Model

> **POSI-EVAL-1.0 (2026-09-28) — read this first.** § 9 (M-Q ranking) and § 10 are retired. An AJR-M score is published with its AJR Rating (A+ … D) from [POSI-EVAL-1.0-SPEC.md](./POSI-EVAL-1.0-SPEC.md) § 3, never with a quartile. The internal percentile normalization of citation sub-metrics (§ 2) is part of scoring and unchanged in `AJR-M-1.1`.

> **Status: implemented in posi-engine** (`src/ajr-mature.mjs`,
> `AJR_M_METHODOLOGY_VERSION = 'AJR-M-1.1'`), covered by unit tests
> (`test/ajr-mature.test.mjs`). Part of the **"POSI Journal Evaluation &
> Ranking Framework 1.0"** methodology overhaul.
>
> **Run monthly since 2026-10** by posi-engine's AJR rerate
> (`.github/workflows/ajr-rerate.yml`, `scripts/rate-mature.mjs`,
> `src/ajr-m-rerate.mjs`) on the Core Collection, which has no Mature journal
> before December 2029. § 11 records where each input comes from; those
> input rules change scores, so ratings computed with them are `AJR-M-1.1`
> (the formulas of §§ 2–8 are unchanged from 1.0). Results
> are stored as `mature_rating` on corpus records, in
> `schema/rating.schema.json`'s shape (`track: mature`).
>
> **This model did not exist before.** [AJR-SPEC.md](./AJR-SPEC.md) § 3
> sketched AJR-M's dimension weights as a design placeholder and explicitly
> listed "exact AJR-M sub-scoring formulas for the non-citation 65 points"
> as an open question (§ 13). This document resolves that open question and
> is the first real AJR-M spec. Until now, mature journals (60+ months)
> were scored with the AJR-E rubric as an interim measure — see
> AJR-SPEC.md § 3 for why that undersells decades of real citation history.
> This spec makes that interim measure unnecessary.

## 1. Scope

Applies to journals in the **Mature** lifecycle stage: `rating_date ≥
launch_date + 60 months`, using exact date-boundary arithmetic
(LIFECYCLE-1.1, see [AJR-E-1.1-SPEC.md](./AJR-E-1.1-SPEC.md) § 10 for the
same boundary rule). **A mature journal must never be scored with the
AJR-E rubric.** 100 points, 6 dimensions:

| Dimension | Weight |
|---|---:|
| 1. Citation Performance & Field-Normalized Impact | 35 |
| 2. Scholarly Output & Publishing Stability | 20 |
| 3. Editorial Governance & Research Integrity | 15 |
| 4. Metadata & Digital Infrastructure | 10 |
| 5. Scholarly Reach & Concentration | 10 |
| 6. Transparency & Access Policy | 10 |
| **Total** | **100** |

**AJR-M is not a repackaged PCI ranking.** Citation performance is the
largest single block (appropriately — a mature journal has enough history
for real citation data to be trustworthy) but not the only one. A mature
journal with strong citations and weak governance/integrity/transparency
does not automatically top the Mature ranking — see § 7's worked example.

## 2. Dimension 1 — Citation Performance & Field-Normalized Impact (35)

The flagship dimension — the thing that makes AJR-M structurally different
from AJR-E, which has no citation history to draw on.

```
S_PCI  = 15 × percentile_PCI  / 100
S_PCI5 = 10 × percentile_PCI5 / 100
S_PNCI = 10 × percentile_PNCI / 100
CitationComponent = S_PCI + S_PCI5 + S_PNCI      (max 35)
```

`percentile_PCI` / `percentile_PCI5` / `percentile_PNCI` are each this
journal's **within-Primary-PSC-category percentile** for that metric and
`metric_year` — computed via the same midrank/percentile core E-Q, M-Q, and
Citation Q all share (`src/quartile-tracks.mjs`'s `percentileMidrank()`),
applied to whichever metric-eligible peer set shares the journal's primary
PSC category. **Percentiles, not raw values, are the input specifically so
a naturally-high-citation field (e.g. medicine) cannot structurally
dominate a naturally-low-citation field (e.g. history)** — a journal at the
92.5th percentile in History and a journal at the 92.5th percentile in
Medicine receive the identical `S_PCI`, despite wildly different raw PCI
scales (verified by `test/ajr-mature.test.mjs`'s field-normalization test).

A journal missing PCI-5 or PNCI history (e.g. not enough years of data
yet, or no category baseline) does **not** score 0 on that sub-metric — the
sub-score is simply excluded, and `computable_max` (the sum of weights that
COULD be computed) shrinks accordingly, so a journal is never penalized for
a metric it structurally cannot have.

## 3. Dimension 2 — Scholarly Output & Publishing Stability (20)

| Item | Weight | Basis |
|---|---:|---|
| Five-year publication continuity | 4 | Proportional: years with ≥1 qualifying publication out of the last 5 |
| Annual output stability | 4 | Coefficient of variation (CV) of yearly output — **lower CV scores higher**; volume itself is never rewarded |
| Publication schedule adherence | 3 | Tiered, mirrors AJR-E's cadence tiers (≥90%→full, 75–89%→80%, 60–74%→40%, <60%→0) |
| Article structural/metadata quality | 4 | Evidence item (Evidence Coverage normalized) |
| DOI deposit timeliness | 3 | Evidence item |
| Publication/date consistency | 2 | Evidence item |

**Annual output stability is calibrated by consistency, not volume**
(framework: "use coefficient of variation ... rather than 'more articles
is better'") — verified by test: a steady 10-articles/year journal and a
steady 500-articles/year journal score identically (both maxed), while a
journal alternating between 10 and 90 articles/year scores lower than a
journal holding steady around 50, regardless of either journal's average
volume. **JUDGMENT CALL (flagged):** the framework asks for
"field/access-model calibrated" CV benchmarks but gives no concrete
per-field table; `scoreOutputStability()` accepts an optional
`cvBenchmark` parameter (default `0.5`) rather than inventing a per-field
table this project has no evidentiary basis for — a caller with real
field-level CV distributions can supply a calibrated benchmark per PSC
category.

## 4. Dimension 3 — Editorial Governance & Research Integrity (15)

| Item | Weight |
|---|---:|
| Editorial governance | 4 |
| Peer review transparency | 3 |
| Retraction/correction/integrity framework | 3 |
| Authorship/COI | 2 |
| Research/data ethics | 2 |
| AI policy | 1 |

Same Evidence Coverage normalization as every other evidence-backed
dimension in AJR-E/AJR-M — an unresolved item never scores as failed.

## 5. Dimension 4 — Metadata & Digital Infrastructure (10)

| Item | Weight |
|---|---:|
| DOI reliability | 2 |
| Metadata completeness | 2 |
| Structured harvesting | 2 |
| Reference metadata | 1 |
| Long-term preservation | 2 |
| Stable article URLs/HTTPS | 1 |

## 6. Dimension 5 — Scholarly Reach & Concentration (10)

| Item | Weight | Tiers |
|---|---:|---|
| Author concentration | 3 | ≤25%→3, 25–40%→2, 40–60%→1, >60%→0 |
| Institution concentration | 3 | ≤40%→3, 40–60%→2, 60–80%→1, >80%→0 |
| Collaboration breadth | 2 | proportional to unique-institution ratio |
| Citing-source concentration | 2 | ≤40%→2, 40–60%→1, >60%→0 |

**Severe citation anomalies do NOT get scored down here — they route to
Citation Integrity / Suppression instead (§ 8).** `scoreReachConcentrationMature()`
has no citation-integrity input parameter at all — there is no code path
by which an integrity flag could lower this dimension's score. This
dimension measures structural concentration risk (who publishes, who gets
cited from where), never a judgment about whether a citation pattern looks
manipulated.

## 7. Dimension 6 — Transparency & Access Policy (10)

**Identical criteria to [AJR-E-1.1-SPEC.md](./AJR-E-1.1-SPEC.md) § 9** —
implemented once (`shared-dimensions.mjs`'s `scoreTransparency()`) and
imported by both models. This ensures a high-citation mature journal
cannot coast on citation performance while ignoring governance
transparency — Dimension 1 (citations) and Dimension 6 (transparency) are
fully independent inputs to the same 100-point total.

**Worked example** (framework-consistent): a journal with maxed-out
citation performance (S_PCI+S_PCI5+S_PNCI = 35) but no other evidence
resolved at all scores well under 60/100 overall — strong citations alone
cannot carry an AJR-M composite (verified by
`test/ajr-mature.test.mjs`'s "not a repackaged citation ranking" test).

## 8. Citation integrity gate — never a point deduction

Per the framework: "If suppressed: PCI/PCI-5/PNCI/Citation Q/M-Q show
'suppressed' with the specific reason; AJR-M becomes 'not officially
rankable.'" `gateAjrMByIntegrity()` (`src/ajr-mature.mjs`) is the **only**
place a citation-integrity finding is allowed to touch an AJR-M result:

- Unflagged (or flagged-but-not-yet-reviewed — see PJR-SPEC.md § 9, a raw
  flag alone never suppresses) → the computed AJR-M result passes through
  unchanged.
- Flagged **after human review confirms suppression** → the entire result
  is replaced with `{ status: 'not_officially_rankable', reason, flagged_checks }`
  — never a partial score, never a point deduction anywhere in the six
  dimensions above.

Core Collection membership is never auto-removed by a citation-integrity
finding alone (PJR-SPEC.md § 9, unchanged).

## 9. M-Q ranking

AJR-M score → Primary PSC (same `psc_confidence` gate as E-Q — `high`/
`verified` only) → Mature peer cohort → rank → mid-rank → percentile →
**M-Q1–M-Q4**, using the identical RANK-1.0 midrank/percentile formula
E-Q and Citation Q use (`src/quartile-tracks.mjs`'s `rankLifecycleTrack()`).
Same minimum-cohort fallback chain as E-Q: PSC L2 ≥20, else PSC L1 ≥30,
else "score valid, quartile unavailable."

## 10. M-Q vs. Citation Q — two different questions, never collapsed

A journal can legitimately be `M-Q1` (top-tier on the full 100-point
composite) and `Citation Q2` (second-tier on PCI alone) simultaneously —
see § 7's worked example. Both are computed from different inputs
(AJR-M's six-dimension composite vs. PCI alone) and must never be
collapsed into one number or displayed as bare "Q1" — always the full
track name (`M-Q1`, `Citation Q1`; see `src/quartile-tracks.mjs`'s
`quartileLabel()`).

## 11. Inputs and their sources

How posi-engine's runner (`src/ajr-m-rerate.mjs`) resolves the inputs of
§§ 2–8 from this repository. The formulas and weights above are unchanged,
but these rules (the 20-peer minimum, the 80% structural share, how
evidence items combine) change scores, so they define **AJR-M-1.1**. The
items marked **judgment call** are choices the framework leaves open.

**Dimension 1 — citation.** PNCI and the journal's category
(`ranking_category_id`) come from the current Citation Ranking edition
(`rankings/citation/`); PCI and PCI-5 from the PCI audit
(`audits/pjr-seed-corpus/<run>/pci/`, one file per journal; published as
`collections/pci.json` in the data snapshot). PNCI peers are the journals that edition ranks
(official or provisional) in the same category; PCI and PCI-5 peers are the
journals with a value in the same category. A percentile with fewer than 20
peers is not computed (`MIN_CATEGORY_SIZE`, the Citation Ranking's own
minimum) and drops out of `computable_max` as in § 2.

**Dimension 2 — output.** Five-year continuity and output stability read the
last five complete calendar years before the rating date from
`evidence/output/` (OpenAlex `works_count` per year; a missing year counts
as no output). Schedule adherence reads the Article-Sample ETL's cadence,
and DOI deposit timeliness its `deposit_timeliness`. From the article
sample (`evidence/works/`):

- article structural/metadata quality is `met` when, on average, 80% or
  more of AJR-E's structural fields (abstract, references, affiliation,
  ORCID, licence) are present (**judgment call**), `unknown` below 10
  sampled articles;
- publication/date consistency uses AJR-E's batch-dump rule: five or more
  dated articles all on one date is `not_met`, fewer than five is `unknown`.

**Dimensions 3 and 4 — evidence items.** The site crawl and the article
sample resolve AJR-E-1.1's items; each AJR-M item is made of these
(**judgment call**; every AJR-E governance and integrity item is used
exactly once):

| AJR-M item | AJR-E-1.1 evidence items |
|---|---|
| Editorial governance | `aims_scope_explicit`, `editorial_board_public`, `editor_identity_affiliation_verifiable` |
| Peer review transparency | `peer_review_process_disclosed`, `reviewer_editorial_guidelines` |
| Retraction/correction/integrity framework | `corrections_retractions_policy`, `publication_ethics_policy`, `plagiarism_similarity_policy`, `complaints_appeals` |
| Authorship/COI | `authorship_contributorship_policy`, `conflict_of_interest_policy` |
| Research/data ethics | `human_animal_ethics_consent`, `data_availability_sharing` |
| AI policy | `ai_use_policy` |
| DOI reliability | `doi_resolution_reliability` |
| Metadata completeness | `crossref_metadata_completeness` |
| Structured harvesting | `oai_pmh_schema_org_machine_readable` |
| Reference metadata | `abstract_reference_license_metadata` |
| Long-term preservation | `digital_preservation_archiving` |
| Stable article URLs/HTTPS | none yet: always `unknown` |

An AJR-M item made of several evidence items is `met` only when every
applicable one is met, `not_met` as soon as a resolved one is not met, and
otherwise unresolved (**judgment call**: each AJR-M item is a composite
requirement). Dimension 6 reads the AJR-E-1.1 transparency items directly
(§ 7).

**Dimension 5 — reach.** Author share is the share of sampled articles by
the most frequent identifiable author (ORCID or full name, never
affiliation); institution shares are computed only when at least 30% of
authors carry an affiliation, otherwise they take the neutral defaults.
Citing-source concentration has no source yet and takes its neutral
default.

**Eligibility.** Evidence Coverage is computed over every evidence-backed
item (Dimensions 3, 4, 6 and Dimension 2's three evidence items), with the
same 80% official / 60% provisional thresholds as AJR-E. Mandatory evidence:
an ISSN, Mature stage on the rating date, an article sample of at least 10,
a category in the Citation Ranking edition, and an output history.

**Integrity (§ 8).** Only suppressions confirmed by review are passed to
the gate; a raw flag is never one.

## 12. Changelog

**1.0** (this document) — first real AJR-M spec, resolving AJR-SPEC.md
§ 13's open question about AJR-M's non-citation sub-scoring formulas.

**1.1, 2026-10-02** — § 11: where each input comes from, as implemented by
posi-engine's runner. The formulas, weights and thresholds of §§ 2–8 are
unchanged; the input rules of § 11 change scores, hence the new version.
No AJR-M score had been published under 1.0.

**1.2, 2026-10-03** (first applied by the 2026-11 monthly rerate) — the
site-crawl evidence items of § 11 are Evidence Coverage EC-1.1: items the
journal's website leaves unresolved may be resolved from a verified
publisher-wide policy (thirteen inheritable items) and from the journal's
own Crossref deposits (AJR-SPEC.md § 8). Formulas unchanged.
