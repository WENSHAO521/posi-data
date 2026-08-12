# Benchmark Identity Remap 2026 — Audit Summary

Resolves the 1,000 Global Benchmark Collection journals (`corpus/global-benchmark.json`)
against the **current, canonical registry** (`registry/journal-id-map.csv`,
24,205 records as of the Framework 1.0 freeze merge, `ba4929b`) — not the
stale, pre-migration registry the abandoned `pjr-seed-corpus-1000` branch
minted 1,000 experimental ids against. See `posi-data`#1 (closed,
superseded) and `posi-engine`#1's PR description for why those experimental
ids are not canonical and are not reused here.

**Reuse-before-mint, strictly enforced:** this run mints zero new ids. Every
entity that did not resolve against the existing registry is reported for
manual review, never guessed or auto-minted.

## Merge Gate

```
Input benchmark journals: 1000

Matched by ISSN-L:        999
Matched by ISSN set:      0
Matched by OpenAlex:      1
New POSI-J minted:        0
Manual review:            0 / 1000
Hard conflicts:           0
Duplicate identities:     0 unresolved

Identity-layer validation:
1000 / 1000 valid

POSI-J format invalid:       0
Duplicate POSI-J assignment: 0
```

**This is identity-layer validation, not full `schema/journal.schema.json`
conformance.** It checks exactly three things: every assigned `posi_id`
matches the `POSI-J-\d{6,}` shape, every one of the 1000 records received
an assignment, and no `posi_id` was assigned to more than one record. It
does **not** validate `corpus/global-benchmark.json` records against the
full canonical journal schema (`identifiers.*` nesting, `provenance`
array, `status` enum, etc.) — the audit JSON's own field name for this
check, `schema_shape_invalid`, was accurate; the human-readable label
above it was not, and has been corrected. Full schema conformance is
Evidence ETL's job, not this identity-layer pass's.

All 1000 benchmark journals resolved cleanly against the existing registry.
This is the expected outcome, not a coincidence: the recent identity
migration that landed 24,205 canonical `POSI-J-######` records on `master`
(`23a9480` + `00c365e`) explicitly included minting for
`core-collection.json` and `global-benchmark.json` — so every benchmark
journal's identity (ISSN or OpenAlex Source ID) should already have a
reserved registry entry. This run's job was to **verify** that and **join**
`corpus/global-benchmark.json`'s records back up to their already-reserved
`posi_id`, not to perform fresh identity resolution from scratch.

## Method

1. **Internal dedupe first** (`src/migration/dedupe.mjs`'s
   `buildCandidateEntities()`, unchanged, same code used for the real
   23,331-record migration): checks whether any of the 1000 benchmark
   records are themselves duplicates of each other before touching the
   registry at all. Result: 1000 candidate entities from 1000 records — no
   internal duplicates, no internal hard conflicts.
2. **Registry join, by value** (`scripts/remap-benchmark-identity-2026.mjs`
   in `posi-engine`, new): for each candidate entity, checks whether any of
   its ISSN or OpenAlex Source ID values appear **anywhere** in the
   registry, regardless of which `identity_type` the registry recorded that
   value under. This is deliberately looser than a strict tier-by-tier
   lookup (`src/migration/mint.mjs`'s `resolveOrMintIds()`) — a benchmark
   record's raw source data has no `issn_l` field of its own (that's an
   OpenAlex-enrichment-derived distinction), so a strict-tier match would
   compute `issn_pair` for a value the registry itself correctly recorded
   as `issn_l`, producing a **false unresolved result from a type-label
   mismatch, not a genuine identity mismatch**. The value-based join avoids
   that failure mode while still surfacing a real problem if it occurs: an
   entity whose different identity values (e.g. print ISSN vs. online ISSN)
   resolve to two *different* existing `posi_id`s is reported as a
   `registry_conflict`, not silently resolved to either one.
3. **Write-back**: `corpus/global-benchmark.json` gains a new `posi_id`
   field per record (additive — the existing `id`/`journal_code` slug
   fields are untouched, so nothing else that reads this file by its
   current `id` breaks).

## The one OpenAlex-only match

`EGUGA` (`j-bench-eguga-0051` → `POSI-J-023373`) — a conference-abstracts
series (European Geosciences Union General Assembly), which typically
lacks a conventional journal ISSN. Resolved via its OpenAlex Source ID
(`S4306508950`) instead, exactly as the priority chain intends.

This is purely an identity resolution — "who is this entity" — and does
not decide whether a conference-abstracts series should keep participating
in the Global Benchmark Collection for AJR/ranking purposes. That's a
separate **benchmark membership eligibility** question, tracked as a
follow-up for the Evidence ETL phase, not this one. If EGUGA is later
retired from the benchmark set, today's identity mapping stays valid and
is not revoked by that decision.

## What this run does NOT do

- Does not reshape `corpus/global-benchmark.json` records into the full
  canonical `schema/journal.schema.json` structure (`identifiers.*`
  nesting, `provenance` array, `status` enum, etc.) — that reshaping
  belongs to the Evidence ETL phase, when real provenance/status data is
  actually being assembled, not the identity layer.
- Does not touch `corpus/core-collection.json` or any other corpus file —
  scoped to the Global Benchmark Collection only.
- Does not run AJR, Evidence, or PCS — identity only, per the requested PR
  scope.
- Mints nothing. 0 new registry rows written; `registry/journal-id-map.csv`
  is read-only input to this run.

## Reproducibility

`node posi-engine/scripts/remap-benchmark-identity-2026.mjs --registry
registry/journal-id-map.csv --benchmark corpus/global-benchmark.json --out
<dir>`, run against `posi-data@ba4929b` (registry) and `posi-engine@7eb9346`
(script/library code) — see `manifest.json` for the exact commits.
