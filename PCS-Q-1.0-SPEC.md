# PCS-Q 1.0 — PCS Quartile (POSI Journal Rankings)

> **POSI-EVAL-1.0 (2026-09-28) — read this first.** **Retired as a ranking.** PCS is a supplementary independent citation indicator and does not determine the official POSI Citation Rank, Citation Percentile, Citation Quartile, or POSI Zone ([POSI-EVAL-1.0-SPEC.md](./POSI-EVAL-1.0-SPEC.md)). The PCS-Q edition is still built and archived as the source of PCS values; its rank, percentile, quartile and zone fields are not published. PCS-Q1–PCS-Q4 labels are withdrawn. § 7's amendment of PCS-1.0 § 1 is revoked.

> **Status: implemented in posi-engine** (`src/pcs-quartile.mjs`,
> `PCS_Q_METHODOLOGY_VERSION = 'PCS-Q-1.0'`, tests in
> `test/pcs-quartile.test.mjs`; edition builder `scripts/run-pcs-q.mjs`).
> First edition: `rankings/pcs-q/pcs-q-2026.json` (metric year 2026).
>
> Adopted by platform-owner decision, 2026-09-26. Amends
> [PCS-1.0-SPEC.md](./PCS-1.0-SPEC.md) § 1 (see § 7 below).

## 1. What PCS-Q is

PCS-Q is the ranking track behind **POSI Journal Rankings**: every indexed
journal with sufficient PCS data, Core Collection and non-Core alike, is
ranked within its PSC subject category and overall by **PCS**
([PCS-1.0-SPEC.md](./PCS-1.0-SPEC.md)), with a percentile and a quartile.

It is a fourth quartile track beside E-Q, M-Q and Citation Q
([AJR-SPEC.md](./AJR-SPEC.md) § 5, [PJR-SPEC.md](./PJR-SPEC.md) § 8). The
tracks are independent: PCS-Q never feeds E-Q, M-Q or Citation Q, and none
of them feeds PCS-Q.

## 2. Algorithm

RANK-1.0, exactly as in [PJR-SPEC.md](./PJR-SPEC.md) § 8, with PCS as the
input score (posi-engine `quartile-tracks.mjs`'s `percentileMidrank()`,
shared with the other tracks, not copied):

1. Rank eligible journals by PCS, descending. Competition rank (1, 2, 2, 4).
2. Tied PCS values share the mid-rank of the positions they occupy.
3. `percentile = 100 * (N - rank_mid + 0.5) / N`
4. Quartile from percentile: Q1 ≥ 75, Q2 ≥ 50, Q3 ≥ 25, else Q4.

**Display label is always `PCS-Q1` … `PCS-Q4`**, never a bare `Q1`
(same rule as E-Q / M-Q / Citation Q).

## 3. Eligibility

A journal is PCS-Q eligible when all of the following hold. Each record in
an edition carries the first failed rule as `exclusion_reason`.

| Rule | Value | `exclusion_reason` |
|---|---|---|
| PCS computed | `pcs` is a number | `no_pcs` |
| Enough eligible items | `pcs_eligible_items ≥ 5` | `too_few_items` |
| Complete fetch | `pcs_coverage ≥ 0.9` | `incomplete_fetch` |

Eligible journals receive an **overall** rank across all categories.

A **category** rank additionally requires:

| Rule | Value | `exclusion_reason` |
|---|---|---|
| Not a general journal (PSC-CROSSWALK-0.3) | `psc_confidence` ≠ `multidisciplinary` | `multidisciplinary` |
| Primary PSC category assigned | `psc_category` not null | `no_psc_category` |
| Rank-eligible classification | `psc_confidence` ∈ {high, verified} (posi-engine `isRankEligiblePscConfidence`) | `psc_confidence_not_rank_eligible` |
| Category size | ≥ `MIN_CATEGORY_SIZE` = 20 eligible journals, flat, no Level-1 fallback (same as Citation Q) | `category_below_min_size` |

Collection membership (Core, Global Benchmark, Discovered, registry-only)
is **not** an eligibility input — consistent with [AJR-SPEC.md](./AJR-SPEC.md)
§ 14. Eligibility is decided by the data rules above alone.

## 4. Edition format

`rankings/pcs-q/pcs-q-<Y>.json`:

```json
{
  "methodology_version": "PCS-Q-1.0",
  "metric_year": 2026,
  "generated_at": "…",
  "parameters": { "min_items": 5, "min_coverage": 0.9, "min_category_size": 20,
                  "rank_eligible_psc_confidence": ["high", "verified"] },
  "inputs": [{ "file": "pcs.json", "sha256": "…" }, …],
  "records": [{
    "journal_id": "POSI-J-023334", "track": "pcs", "metric_year": 2026,
    "pcs": 35.54, "pcs_eligible_items": 14471, "category_code": "P1.04",
    "rank": 3, "rank_mid": 3, "category_size": 91, "percentile": 97.25,
    "quartile": "Q1", "quartile_label": "PCS-Q1",
    "overall_rank": 78, "overall_size": 4067, "overall_percentile": 98.09, "overall_quartile": "Q1",
    "ranking_method": "pcs_midrank", "exclusion_reason": null, "tied_with": [],
    "methodology_version": "PCS-Q-1.0"
  }]
}
```

Alongside: `pcs-q-<Y>.csv` (flat) and `summary.json` (counts by outcome
and category size). Input files are listed with SHA-256 so an edition can
be rebuilt and compared byte for byte (apart from `generated_at`).

## 5. Scope and coverage

The 2026 edition covers the journals that currently have PCS snapshots:
the Core Collection and the Global Benchmark Collection (4,320 journals;
4,067 overall-ranked; 3,864 category-ranked in 20 categories). Extending
PCS, and therefore PCS-Q, to every journal indexed by POSI is specified in
[GLOBAL-INDEX-1.0-SPEC.md](./GLOBAL-INDEX-1.0-SPEC.md). The algorithm and
eligibility rules do not change with coverage.

## 6. Relationship to Citation Q

Citation Q (PCI-based, [PJR-SPEC.md](./PJR-SPEC.md) § 8) is unchanged and
remains the PCI track. Where both exist, a journal page shows both labels;
they are never averaged or reconciled.

## 7. Amendment to PCS-1.0-SPEC.md § 1

PCS-1.0 § 1 previously stated that PCS does not determine any rank,
percentile or quartile. From PCS-Q-1.0 it reads: PCS determines the
**PCS-Q** track only, and does not determine Citation Rank, Citation
Percentile or Citation Quartile (Citation Q), E-Q or M-Q. The PCS formula
itself is unchanged (still `PCS-1.0`).

## 8. Changelog

- **PCS-Q-1.0** (2026-09-26) — initial version.
