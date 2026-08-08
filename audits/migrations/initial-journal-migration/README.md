# Initial Journal Migration — Pre-Migration Audit v0.1

This is a **read-only audit**, not a migration. It records what the legacy
POSI website's journal corpus looked like *before* any cleanup — no
`POSI-J-######` id has been assigned, and nothing has been written to
`journals/`. See `posi-engine`'s migration pipeline
([src/migration/](https://github.com/WENSHAO521/posi-engine/tree/master/src/migration))
for the code that produced this, and `PJR-SPEC.md § 12` for why it's
structured this way.

## Why publish an unpolished v0.1 rather than wait for cleanup

Publishing this now — before OpenAlex enrichment, before the 171
possible-duplicate groups are manually reviewed, before country-name
normalization is extended — preserves an honest record of what the raw
legacy corpus actually looked like. A later, cleaner **v1.0** audit (after
enrichment and review) will supersede this one for migration purposes, but
v0.1 stays published: the diff between v0.1 and v1.0 is itself part of
POSI's public, auditable trail from raw legacy data to canonical corpus.

## Headline numbers

| Metric | Value |
|---|---|
| Source records | 23,822 |
| Candidate journal entities | 23,819 |
| Hard identity conflicts | 0 |
| Duplicate groups found (auto-merged via ISSN overlap) | 3 |
| Possible duplicates flagged for human review (never auto-merged) | 171 |
| Invalid identifiers (ISSN checksum/shape failures) | 4 |
| ISSN-L coverage | 0% (legacy site never tracked this field) |
| Valid ISSN (print or online) coverage | 100% |
| OpenAlex Source ID coverage | 0.04% (1 of 23,822) |

Full detail in `audit-summary.md` / `audit-summary.json`.

## Files in this directory

| File | Contents |
|---|---|
| `audit-summary.md` | Human-readable report (coverage stats, methodology notes) |
| `audit-summary.json` | Machine-readable version of the same |
| `manifest.json` | Provenance: source/engine/schema commits, release asset checksums |
| `possible-duplicates.csv` | All 171 groups — title+publisher match, ISSNs don't overlap, needs human review |
| `invalid-identifiers.csv` | The 4 ISSNs that failed checksum validation |
| `hard-conflicts.csv` | Empty in this run (0 conflicts found) |
| `duplicate-groups.jsonl` | The 3 groups the pipeline did auto-merge, and why |
| `unresolved-records.jsonl` | Empty in this run (every record had at least a valid ISSN) |

## Bulk artifacts (not committed to Git history)

`candidate-entities.jsonl` (all 23,819 entities) and
`normalization-warnings.csv` (4,468 rows, mostly unmapped country names) are
large, machine-generated outputs — published as gzipped assets on the
[`initial-journal-migration-audit-v0.1`](https://github.com/WENSHAO521/posi-data/releases/tag/initial-journal-migration-audit-v0.1)
release instead of committed directly, per `posi-data`'s large-file policy
(see the repo README). Checksums for both are in `manifest.json` and in the
release's own `SHA256SUMS` asset.

## Known gaps this audit surfaces (not blockers to publishing, but tracked)

- **OpenAlex Source ID coverage is 0.04%.** Tier 3 of the identity-
  resolution priority is essentially unpopulated for this corpus. The next
  planned step is an OpenAlex enrichment pass keyed on the 100%-covered
  valid ISSNs, which should also help resolve a meaningful share of the 171
  possible-duplicate groups (two ISSNs resolving to the same OpenAlex
  Source / ISSN-L is strong duplicate evidence).
- **4,405 of the 4,468 normalization warnings are unmapped country names** —
  `posi-engine`'s country-name map is intentionally small (~60 common
  names); most of the legacy corpus's country field needs a broader,
  reviewed alias table. Doesn't block identity resolution (country isn't an
  identity signal), but affects country-level statistics until it's done.
- **DOAJ-listed coverage is 99.9%.** This corpus is, structurally, still a
  DOAJ/OA-journal discovery list, not yet a broad multi-publisher corpus.
  Worth remembering before describing migrated counts as a general "global
  journal" figure.
