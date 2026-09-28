# POSI-EVAL 1.0 — POSI Journal Evaluation Architecture

> **Status: in force from 2026-09-28.** Implemented in posi-engine
> (`src/evaluation.mjs`, `src/pnci.mjs`, `src/citation-ranking.mjs`,
> `scripts/run-citation-ranking.mjs`) and read, never recomputed, by the
> website. Supersedes the quartile parts of [AJR-SPEC.md](./AJR-SPEC.md)
> (E-Q / M-Q), [PJR-SPEC.md](./PJR-SPEC.md) § 6 (journal-level PNCI) and § 8
> (PCI Citation Q), [PCS-Q-1.0-SPEC.md](./PCS-Q-1.0-SPEC.md) (PCS quartiles)
> and [POSI-ZONES-1.0-SPEC.md](./POSI-ZONES-1.0-SPEC.md). Where any older
> document disagrees with this one, this one applies.

## 1. Architecture

POSI evaluates a journal in five layers. Each answers one question, has its
own output vocabulary, and never feeds or relabels another.

| Layer | Question | Output | Never |
|---|---|---|---|
| 1. **PQF** — Core Collection Eligibility | Can the journal enter, or remain in, the Core Collection? | PQF score 0–100 + status | a rank, a quartile, a claim of impact |
| 2. **AJR** — Journal Development / Lifecycle Rating | How strong is the journal's publishing-development profile for its lifecycle stage? | AJR Score 0–100 + AJR Rating (A+ … D) | a quartile, a subject rank, a percentile |
| 3. **Citation Indicators** — PCI, PNCI, PCS | What does citation evidence show? | three numbers | — |
| 4. **Citation Ranking** | Where does the journal rank within its PSC category? | Citation Rank, Citation Percentile, Citation Quartile (C-Q1 … C-Q4) | any input other than PNCI |
| 5. **POSI Zones** | POSI's selective grouping of the same ranking | Zone 1 … Zone 4 | a different percentile from layer 4 |

```
PQF    ≠ ranking
AJR    ≠ quartile
PCS    ≠ official ranking
PNCI   = official subject-ranking metric
Citation Quartile = standard 25% grouping of the PNCI percentile
POSI Zone         = POSI's selective grouping of the same percentile
```

Q1–Q4 are used for exactly one thing: the Citation Quartile. There is no
AJR quartile, no PQF quartile and no PCS quartile. The website displays the
Citation Quartile as **C-Q1 … C-Q4**; data stores `Q1` … `Q4`.

## 2. Core Collection Eligibility — PQF

PQF keeps its definition, subfactors (JTF, MQF, EGF, TDF, CVF, RIF) and its
0–100 score. Its public output is a status:

| PQF score | Status (`pqf_status`) |
|---|---|
| ≥ 70 | Eligible (`eligible`) |
| 50 – 69.99 | Review Required (`review_required`) |
| 40 – 49.99 | Insufficient Evidence (`insufficient_evidence`) |
| < 40 | Not Eligible (`not_eligible`) |

> PQF is an eligibility and quality-framework assessment. It is not a
> citation ranking metric and does not determine Citation Quartiles or POSI
> Zones.

The legacy letter `pqf.grade` (A+ … E) stays in the data for the record and
is not published: it would read like an AJR Rating. PQF may be used as a
filter (e.g. PQF ≥ 70); it is never a default sort and never labels journals
"top".

## 3. Journal Lifecycle Evaluation — AJR

| Stage | Months since first publication | AJR model |
|---|---|---|
| Observation | 0 – 11 | none: no score |
| Early-stage | 12 – 59 | **AJR-E** — Early-stage Journal Rating (`AJR-E-1.1`) |
| Mature | ≥ 60 | **AJR-M** — Mature Journal Rating (`AJR-M-1.0`) |

AJR output is an **AJR Score** (0–100) and an **AJR Rating**:

| AJR Score | AJR Rating |
|---|---|
| 90.00 – 100.00 | A+ |
| 85.00 – 89.99 | A |
| 80.00 – 84.99 | A− |
| 75.00 – 79.99 | B+ |
| 70.00 – 74.99 | B |
| 65.00 – 69.99 | B− |
| 60.00 – 64.99 | C+ |
| 50.00 – 59.99 | C |
| 0 – 49.99 | D |

> AJR Ratings are absolute lifecycle ratings. They are not citation
> quartiles and should not be interpreted as relative subject rankings.

The rating comes only from the unrounded score (`getAJRRating()`,
`AJR-RATING-1.0`). It is never derived from a legacy E-Q/M-Q quartile: an
E-Q1 is not an A. A mature journal is never scored with the AJR-E rubric; until
AJR-M has been run on it, it shows "AJR-M: not yet rated".

**Retired:** E-Q1 … E-Q4 and M-Q1 … M-Q4. Legacy fields
(`early_stage_rating.provisional_quartile`, `quartile`, `quartile_label`,
`cohort_*`, `ranking_method`) are kept in historical records, marked
deprecated in `schema/rating.schema.json`, and not read or published.

## 4. Citation Indicators

| Indicator | Role | Source |
|---|---|---|
| **PCI** — POSI Citation Impact | source citation performance indicator, unchanged (PCI-1.0, [PJR-SPEC.md](./PJR-SPEC.md) § 5–6) | OpenAlex |
| **PNCI** — POSI Normalized Citation Indicator | the primary ranking metric ([PNCI-1.0-SPEC.md](./PNCI-1.0-SPEC.md)) | Crossref item-level citation counts |
| **PCS** — POSI Citation Score | supplementary independent citation indicator, unchanged (PCS-1.0) | Crossref |

PCI is not compared across fields. PCS is kept and published, and:

> PCS is a supplementary citation indicator and does not determine the
> official POSI Citation Rank, Citation Percentile, Citation Quartile, or
> POSI Zone.

**PNCI.** For journal *j* with *n_j* eligible items:

```
PNCI_j = (1 / n_j) × Σ_i  C_i / E(field_i, year_i, type_i)
```

*C_i* is the citation count of item *i*; *E* the mean citation count of all
eligible items of the same PSC field, publication year and document type.
PNCI = 1.00 is the average of the comparison group, > 1 above it, < 1 below.
When a (field, year, type) group has fewer than 50 items or no citations, the
item is normalized against its (field, year) group; the journal's
`pnci_normalization` records that. Every value carries
`pnci_model_version` (`PNCI-1.0`).

Total citations are descriptive only; they never enter the ranking.

## 5. Citation Ranking Method

> Citation Quartiles and POSI Zones are based on PNCI-derived percentiles
> within eligible PSC categories.

- **Metric:** PNCI, unrounded.
- **Cohort:** the journals of one PSC category (the journal's primary PSC
  category, see § 12) that meet § 9 at the provisional level or better.
  Categories are never pooled; there is no overall cross-category ranking.
- **Order:** PNCI descending.
- **Ties (§ 10):** equal PNCI (within 1e-9) share a competition rank
  (1, 2, 2, 4), a mid-rank and everything derived from it.

## 6. Citation Percentiles

For a tied group occupying rank positions *r_start … r_end* in a cohort of *N*:

```
r_mid      = (r_start + r_end) / 2
percentile = 100 × (N − r_mid + 0.5) / N        clamped to 0–100
```

Stored at full precision; displayed with at most one decimal.

## 7. Citation Quartiles

| Percentile | Citation Quartile | Display |
|---|---|---|
| ≥ 75 | Q1 | C-Q1 |
| 50 – < 75 | Q2 | C-Q2 |
| 25 – < 50 | Q3 | C-Q3 |
| < 25 | Q4 | C-Q4 |

Quartiles follow the percentile, not a fixed 25% count: ties are never split
to fill a quartile.

## 8. POSI Zones (POSI-ZONES-2.0)

Zones read the same percentile, counted from the top of the ranking:

| Percentile | Zone | Label |
|---|---|---|
| ≥ 95 | Zone 1 | Top 5% |
| 80 – < 95 | Zone 2 | Top 5–20% (5th–20th percentile from the top) |
| 50 – < 80 | Zone 3 | Top 20–50% (20th–50th percentile from the top) |
| < 50 | Zone 4 | Top 50–100% (lower 50%) |

Zones are independent of the quartile: a C-Q1 journal can be in Zone 1, 2 or
3.

## 9. Minimum Data Requirements

| Requirement | Rule | Status when not met |
|---|---|---|
| Citation coverage (PCS-1.0 `pcs_coverage`: DOIs fetched ÷ DOIs enumerated) | ≥ 90% | `incomplete_coverage` |
| Eligible citable items | ≥ 20 official; 10 – 19 provisional | < 10: `insufficient_items` (`observation` for a journal in its Observation stage) |
| Publication years | official needs items in ≥ 2 years | 1 year: `provisional` |
| PNCI and a rank-eligible category | PSC confidence high or verified, not multidisciplinary | `not_available` |
| Category size *N* (cohort of § 5) | see below | `insufficient_category` |

| *N* | Rank, percentile, Citation Quartile | POSI Zone |
|---|---|---|
| ≥ 50 | yes | official |
| 30 – 49 | yes | provisional |
| 20 – 29 | yes | none |
| < 20 | no (PNCI only) | none |

A provisional journal (10 – 19 items, or one publication year) has a
provisional rank, percentile and quartile ("Provisional C-Q2") and no zone.

`citation_ranking_status` is one of `official`, `provisional`,
`insufficient_items`, `insufficient_category`, `incomplete_coverage`,
`observation`, `not_available`; `ranking_status_reason` names the rule.
`zone_status` is `official`, `provisional` or `not_assigned`. Both come only
from `getCitationRankingStatus()` / `getRankingOutputs()`.

## 10. Ties

Ties are never broken by title, ISSN, date, id or input order. Tied journals
share rank, mid-rank, percentile, quartile and zone; `tied_with` lists them.

## 11. Provisional Rankings

Provisional values are published with their status and never presented as
official. A provisional journal's rank still takes its place in the cohort,
so official journals' percentiles do not depend on whether provisional ones
are shown.

## 12. Category Assignment

The ranking category is the journal's primary PSC category
([PSC-CROSSWALK.md](./PSC-CROSSWALK.md)); an editor-confirmed (`verified`)
primary category takes precedence. The primary category is never chosen by
which category would give the better quartile. Multidisciplinary journals
have no ranking category.

## 13. Ranking Snapshots

Every ranking record carries `ranking_snapshot_date` (the day the cycle built
the edition), `metric_year`, and the versions of § 14. A published edition is
never recomputed in place: a new cycle publishes a new edition.

## 14. Versioning

| Component | Version |
|---|---|
| Evaluation architecture | `evaluation_version` = `POSI-EVAL-1.0` |
| Citation ranking | `ranking_methodology_version` = `CITATION-RANK-1.0` |
| PNCI | `pnci_model_version` = `PNCI-1.0` |
| POSI Zones | `zones_version` = `POSI-ZONES-2.0` |
| AJR | `AJR-E-1.1`, `AJR-M-1.0`, rating scale `AJR-RATING-1.0` |
| PQF | `PQF v1.0` |
| PCI / PCS | `PCI-1.0` / `PCS-1.0` |

## 15. Limitations

- Citation indicators measure citation performance, not every dimension of
  scholarly quality.
- Citation practices vary across fields.
- PNCI reduces but cannot eliminate all disciplinary and database-coverage
  differences; its citation counts are those Crossref records.
- New or small journals may have unstable estimates. POSI therefore applies
  minimum sample, coverage and category-size requirements.
- A ranking describes a journal's citation performance in one snapshot. It is
  not a definitive ranking, and not a measure of individual articles or
  researchers.

## 16. Data model

Unified per-journal evaluation (website API `evaluation`, see
`schema/evaluation.schema.json`):

```json
{
  "pqf": { "score": 82.4, "status": "eligible", "version": "PQF v1.0" },
  "ajr": { "model": "AJR-M", "score": 86.4, "rating": "A", "status": "official", "version": "AJR-M-1.0" },
  "citations": { "pci": 1.62, "pnci": 1.83, "pnciModel": "PNCI-1.0", "pcs": 1.41, "eligibleItems": 128, "coverage": 0.97 },
  "ranking": { "categoryId": "P1.04", "category": "…", "rank": 12, "total": 386, "percentile": 97.0,
               "quartile": "Q1", "zone": 1, "zoneStatus": "official", "status": "official", "snapshot": "2026-09-28" },
  "evaluationVersion": "POSI-EVAL-1.0"
}
```

Ranking editions: `rankings/citation/citation-ranking-<Y>.json.gz`
(posi-engine release asset → `import-global-index` → published as
`collections/citation-ranking.json.gz`). Field names per record:
`pnci`, `pnci_model_version`, `pnci_normalization`, `eligible_citable_items`,
`publication_years`, `citation_coverage`, `median_normalized_citation`,
`top10_share`, `total_citations`, `pci`, `pcs`, `ranking_category_id`,
`ranking_category_name`, `category_cohort_size`, `citation_rank`,
`citation_rank_mid`, `citation_rank_total`, `citation_percentile`,
`citation_quartile`, `posi_zone`, `zone_status`, `citation_ranking_status`,
`ranking_status_reason`, `tied_with`, `ranking_snapshot_date`,
`evaluation_version`.

## 17. Invariants (checked before every release and every website build)

- Every AJR score has a valid AJR Rating equal to `getAJRRating(score)`.
- Every official citation ranking has PNCI, a category, a rank, a percentile
  and a quartile; with *N* ≥ 50 it has an official zone.
- Quartile and zone always equal the rule applied to the stored percentile.
- Tied PNCI values in a category have the same rank and percentile.
- No Q value comes from anything but the Citation Quartile.

## 18. Changelog

- **POSI-EVAL-1.0** (2026-09-28) — initial version.
