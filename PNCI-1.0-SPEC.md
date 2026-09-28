# PNCI 1.0 — POSI Normalized Citation Indicator

> **Status: in force from 2026-09-28.** posi-engine `src/pnci.mjs`
> (`PNCI_MODEL_VERSION = 'PNCI-1.0'`). The ranking metric of
> [POSI-EVAL-1.0-SPEC.md](./POSI-EVAL-1.0-SPEC.md). Replaces the journal-level
> "PCI ÷ category baseline" PNCI of [PJR-SPEC.md](./PJR-SPEC.md) § 6, which
> was never published as a ranking input.

## 1. Formula

```
PNCI_j = (1 / n_j) × Σ_{i ∈ j}  C_i / E(f_i, y_i, t_i)
E(f, y, t) = Σ C / count, over every baseline item of PSC field f,
             publication year y and document type t
```

## 2. Items

- The eligible items of the PCS window: citable document types (PJR-SPEC.md
  § 5 table: research, review, systematic review, meta-analysis, data
  article) published in the four complete years before the metric year.
- *C_i*: Crossref `is-referenced-by-count` at harvest time. An absent count is
  0, as in PCS-1.0 § 7.
- The same fetch as PCS (posi-engine `run-pcs-etl.mjs`), kept per journal as
  citation histograms by publication year and document type (`cells`).

## 3. Baselines

- Field *f* is the journal's primary PSC category. Multidisciplinary and
  unclassified journals have no field and no PNCI.
- Baseline population: every journal with a field and citation coverage
  ≥ 90%.
- A (f, y, t) group with fewer than 50 items, or with no citations at all,
  is replaced by its (f, y) group; the journal's `pnci_normalization` is then
  `field_year_type+field_year_fallback`, otherwise `field_year_type`. Items
  whose (f, y) group has no citations are left out (`items_without_baseline`).

## 4. Descriptive distribution fields (not ranked)

`median_normalized_citation` (median of C_i / E) and `top10_share` (share of
items at or above the 90th citation percentile of their baseline group).

## 5. Versioning

Any change to the item set, the baseline rule or the fallback threshold is a
new `PNCI-x.y` with a CHANGELOG entry.
