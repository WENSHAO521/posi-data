# POSI Journal Migration — Dry Run Report

Generated: 2026-08-08T17:10:26.717Z
Mode: **dry-run** (no POSI-J ids generated, nothing written to `journals/`)
Source: WENSHAO521/Panorama-Open-Scholarly-Index@9b2d4ad90073ae069c7d47a25af7778e5e41a65f (`migration-source.jsonl`)
Engine: d637a2672208ddd688034fa4b430417378f4006f
Schema: 2f099e80ee1d6ee553fddf0b4bef478f6fc2d889

## Summary

| Metric | Value |
|---|---|
| Source records | 23822 |
| Candidate journal entities | 23819 |
| — resolved (ISSN and/or OpenAlex match) | 23819 |
| — unresolved (no strong identity signal) | 0 |
| Duplicate groups (2+ source records → 1 entity) | 3 |
| Records absorbed into a duplicate group | 6 |
| Hard identity conflicts | 0 |
| Possible duplicates (title+publisher match, not merged) | 171 |
| Invalid identifiers (malformed/checksum-failed ISSN) | 4 |
| Normalization warnings (all types) | 4468 |

## Source composition

- `psg`: 12
- `indexed`: 3
- `shiharr`: 13
- `other_indexed`: 2
- `discovered`: 23792

## Field coverage

| Field | Count | % of source records |
|---|---:|---:|
| ISSN-L | 0 | 0.0% |
| Valid ISSN (print or online) | 23822 | 100.0% |
| OpenAlex Source ID | 1 | 0.0% |
| Publisher | 15931 | 66.9% |
| Country | 19417 | 81.5% |
| Website URL | 23046 | 96.7% |
| DOAJ listed | 23792 | 99.9% |

## What this means for the identity registry priority

- **ISSN-L coverage of 0.0%** — this source has never
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
