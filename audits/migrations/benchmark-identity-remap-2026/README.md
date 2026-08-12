# Benchmark Identity Remap 2026

First step of the post-Framework-1.0 production data phase — the identity
foundation layer every later step (Evidence ETL, AJR-E/AJR-M production
runs, PCS Crossref ETL) depends on, per the ordering the platform owner
set: identity must be correct before anything else attaches results to it.

See [audit-summary.md](./audit-summary.md) for the full method and merge-gate
numbers. Short version: all 1000 Global Benchmark Collection journals
resolved against the current 24,205-record canonical registry with zero new
ids minted, zero conflicts, and zero records requiring manual review.

## Files

- `audit-summary.md` — human-readable report, merge-gate table.
- `audit-summary.json` — same summary, machine-readable.
- `manifest.json` — provenance (registry/engine commits, counts).
- `resolved-mapping.csv` — the 1000 `legacy_id -> posi_id` assignments.
- `unresolved-manual-review.jsonl` — empty this run (0 records).
- `registry-conflicts.json` — empty this run (0 records). Would hold any
  entity whose distinct identity values resolved to more than one existing
  `posi_id`.
- `hard-conflicts.json` / `possible-duplicates.json` — empty this run (0
  records). Internal-dedupe output, from the same `dedupe.mjs` used for the
  real 23,331-record migration.
- `value-type-mismatches.json` — empty this run (0 records). Informational
  only: would flag an entity whose multiple matched values were recorded
  under different `identity_type` labels in the registry for the same
  `posi_id` (not an error, just worth a human glance if it ever happens).

## What changed outside this directory

`corpus/global-benchmark.json` — each of the 1000 records gained a new
`posi_id` field (additive; existing fields untouched).
