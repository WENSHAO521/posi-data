# POSI Journal Evaluation Architecture 1.0 — data migration (2026-09-28)

Spec: [POSI-EVAL-1.0-SPEC.md](../../../POSI-EVAL-1.0-SPEC.md). Script:
[`scripts/migrate-evaluation-1.0.mjs`](../../../scripts/migrate-evaluation-1.0.mjs).

## What changed in `corpus/`

Additive only. Every `early_stage_rating` gains:

| Field | Value |
|---|---|
| `rating` | AJR Rating (A+ … D) from the record's own published score; `null` when no score is published |
| `rating_version` | `AJR-RATING-1.0` |
| `deprecated_fields` | the legacy quartile fields present on the record |

No field was removed or changed. A semantic diff of
`corpus/global-benchmark.json` against the previous commit, with the three new
keys removed, is identical record for record.

| Corpus | Journals | With an AJR Rating |
|---|---|---|
| core-collection | 31 | 8 (6 official, 2 provisional AJR-E-1.1 scores) |
| global-benchmark | 4,289 | 0 (the 99 legacy "mature" AJR-E-1.0 scores are not AJR-M scores and get no rating) |

Core Collection ratings: grhas 80.87 A−, jlpcs 85.72 A, jmss 75.26 B+,
jcsis 64.92 C+, jcac 67.37 B−, jyyjx 82.27 A− (provisional), jassp 81.14 A−
(provisional), tjiss 58.45 C.

## Deprecated, kept

- `early_stage_rating.provisional_quartile` (legacy E-Q/M-Q: 42 Global
  Benchmark records carry an M-Q value), `quartile`, `quartile_label`,
  `cohort_*`, `ranking_method`: not read, not published, not mapped to a
  rating (an M-Q1 is not an A).
- `pqf.grade` (A+ … E): kept; the published PQF output is the score and its
  status band.
- `rankings/pcs-q/` (PCS-Q quartiles) and `collections/citation-rankings.json`
  (PCI Citation Q, 2 records): archived; no longer a published ranking.

## Citation Ranking

The first PNCI-1.0 edition needs per-item citation histograms, which PCS
results computed before posi-engine's PNCI-1.0 change do not carry. It is
produced by the next global-index cycle, or at once by running posi-engine's
"Global index and rankings" workflow with `pnci_backfill`; `import-global-index`
then imports it into `rankings/citation/`.

`node scripts/migrate-evaluation-1.0.mjs --check` verifies that every stored
rating equals the rating of its score.
