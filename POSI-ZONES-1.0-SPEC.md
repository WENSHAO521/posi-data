# POSI-ZONES 1.0 — POSI Zones (POSI 分区)

> **POSI-EVAL-1.0 (2026-09-28) — read this first.** **Superseded by POSI-ZONES-2.0** ([POSI-EVAL-1.0-SPEC.md](./POSI-EVAL-1.0-SPEC.md) § 8–9): zones are read from the PNCI mid-rank percentile (≥ 95 Zone 1, ≥ 80 Zone 2, ≥ 50 Zone 3, else Zone 4) within PSC categories only, with category-size rules (official zones need N ≥ 50). The PCS-Q-based trial below is history.

> **Status: trial, published 2026-09-27.** Zones are shown on the website from
> the current PCS-Q edition. The first release of record accompanies the
> annual POSI-R release in December; this document may change before then,
> and any change is recorded in [CHANGELOG.md](./CHANGELOG.md).

## 1. What zones are

A second reading of the PCS-Q rankings ([PCS-Q-1.0-SPEC.md](./PCS-Q-1.0-SPEC.md)):
the same rank, divided into four tiers of unequal size rather than four
equal quarters, so the top tier is selective. Quartiles remain the primary,
internationally comparable reading; zones sit beside them and never replace
them.

## 2. Rule

For a journal at rank `r` in a ranking of `N` journals (the PCS-Q `rank` and
`category_size`, or `overall_rank` and `overall_size`):

| Zone | Condition | Share of the ranking |
|---|---|---|
| Zone 1 | `r / N ≤ 0.05` | top 5% |
| Zone 2 | `r / N ≤ 0.20` | next 15% |
| Zone 3 | `r / N ≤ 0.50` | next 30% |
| Zone 4 | otherwise | remaining 50% |

Zones are assigned within each subject category (category zone) and across
all ranked journals (overall zone). A journal with no category rank has no
category zone.

## 3. Eligibility

Exactly the PCS-Q eligibility (PCS-Q-1.0-SPEC.md): a journal is zoned
wherever it is ranked, and nowhere else. No journal is placed in a zone by
hand, and Core Collection journals — including those published by
Panorama Scholarly Group — follow the same rule as every other journal.

## 4. Labels

Always "Zone 1" … "Zone 4" (English) or "1区" … "4区" with the POSI name
(Chinese), so they cannot be mistaken for zones or quartiles published by
other services.

## 5. Planned for the release of record

Under consideration for December, each as a versioned change: a three-year
PCS average for stability, a cap on self-citation, separate handling of
review journals, and a "Top journal" mark within Zone 1.
