# POSI Journal Migration — Dry Run Report

Generated: 2026-08-11T16:33:20.597Z
Mode: **dry-run** (no POSI-J ids generated, nothing written to `journals/`)
Source: WENSHAO521/posi-data@unknown (`corpus/global-benchmark.json`)
Generator (posi-engine): b23a7778151f829f2c5ad4cf582a53dcf443c475
Spec (posi-data): 05daea90dd0275f1f73bdb28cffb3a72c4878501

## Summary

| Metric | Value |
|---|---|
| Source records | 1000 |
| Candidate journal entities | 1000 |
| — resolved (ISSN and/or OpenAlex match) | 1000 |
| — unresolved (no strong identity signal) | 0 |
| Duplicate groups (2+ source records → 1 entity) | 0 |
| Records absorbed into a duplicate group | 0 |
| Hard identity conflicts | 0 |
| Possible duplicates (title+publisher match, not merged) | 0 |
| Invalid identifiers (malformed/checksum-failed ISSN) | 0 |
| Normalization warnings (all types) | 8 |

## Source composition

- `global_benchmark`: 1000

## Field coverage

| Field | Count | % of source records |
|---|---:|---:|
| ISSN-L | 999 | 99.9% |
| Valid ISSN (print or online) | 999 | 99.9% |
| OpenAlex Source ID | 1000 | 100.0% |
| Publisher | 1000 | 100.0% |
| Country | 992 | 99.2% |
| Website URL | 981 | 98.1% |
| DOAJ listed | 0 | 0.0% |

## What this means for the identity registry priority

- **ISSN-L coverage of 99.9%** — this source has never
  distinguished ISSN-L from print/online ISSN, so tier 1 of the identity
  priority is not populated by this migration. Tier 2 (valid ISSN pair) is
  the effective primary signal for this dataset.
- **DOAJ id coverage is 0%** — this source stores `doaj_status` (a
  boolean-ish flag), never a DOAJ journal record id, so tier 4 does not fire
  either. Deduplication here rests on ISSN (tier 2) and OpenAlex Source ID
  (tier 3) only.

## Next steps (not part of this dry run)

1. Review `hard-conflicts.csv` — every row needs a human decision before
   any migration proceeds.
2. Review `possible-duplicates.csv` — title/publisher matches are never
   auto-merged; each is a candidate for manual review only.
3. Re-run this dry run against the same input a second time and diff the
   two `migration-audit.json` files — they must be byte-for-byte identical
   except for `generated_at` (see PJR-SPEC.md § 12's reproducibility
   requirement) before this is trusted for a real migration.
4. Only after review: assign permanent `POSI-J-######` ids to resolved,
   conflict-free candidate entities and commit them to `journals/`.
