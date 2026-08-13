# Publisher-expansion canonical records — 2026-08-13

Closes a gap left by the 2026-08-12 Elsevier/Frontiers bulk publisher-
catalog expansion: `mint-elsevier-jnlactive-2026.mjs` (and its Frontiers
counterpart) minted every `POSI-J-######` id the expansion needed and
appended the rows to `registry/journal-id-map.csv`, but never wrote the
other half PJR-SPEC.md § 12 requires — "bulk migration writes registry
rows and journal records together." 2,177 of those ids resolved to
nothing: a real journal record lookup against them would find no
canonical `journals/core/` or `journals/discovered/` file at all.

## Verification, not assumption

Computed the gap by diffing every unique `posi_id` in
`registry/journal-id-map.csv` (26,387) against every actual record id
present across `journals/core/**/*.json` (1,031) and every
`journals/discovered/*.jsonl` line (23,331) — 24,205 combined, leaving
2,182 registry ids with no canonical record. Of those:

- 11 are `old_posi_id`s in `registry/superseded-ids.csv` — expected to
  have no canonical record (a superseded id is retired, not orphaned;
  lookups resolve through to the surviving id).
- 1 (`POSI-J-024583`) is documented in `registry/excluded-identities.csv`
  as a confirmed ghost record ("no external evidence... left unused, not
  superseded") — also expected to have no canonical record.
- The remaining **2,177** had no explanation on file — a real gap.

All 2,177 have a matching `posi_id` in `corpus/global-benchmark.json`
(every one of them a `publisher_expansion` record from the Elsevier/
Frontiers ingest — none from the original curated seed, which was fully
migrated to canonical records earlier). 0 were unexplained (no registry
id with a gap and no corpus match).

## What was written

`journals/discovered/publisher-expansion-2026.jsonl` — 2,177 new
`status: "discovered"` records, one per gap id, built from that id's
`corpus/global-benchmark.json` record. `journals/discovered/initial-
journal-migration-2026.jsonl` (the original 23,331) is untouched — this
is a new, separate file, not an edit to that one.

Deliberate choices in the mapping, not defaults:

- **`identifiers.issn_l` is always `null`.** Matches
  `mint-elsevier-jnlactive-2026.mjs`'s own already-documented reasoning
  ("raw jnlactive.csv/Frontiers/OpenAlex data has no distinct issn_l
  field") — these ids were minted at the `issn_pair` identity tier, not
  `issn_l`, and the canonical record says so by construction rather than
  overclaiming a verified linking-ISSN.
- **`identifiers.issn_online` is carried through from the corpus record
  unchanged.** This script does not re-derive or "fix" it — it's a
  faithful materialization of the identity `registry/journal-id-map.csv`
  already used to mint the id, not a second opinion on it. (Separately,
  `posi-engine`'s `bulk-ingest-fabricated-defaults-2026` branch stops
  writing this same kind of unverified value into `issn_online` on
  *future* ingest runs — that fix is forward-looking; backfilling the
  existing corpus is a distinct, not-yet-made decision.)
- **`language` is always `null`**, never copied from the corpus record's
  own `language` field even where it isn't null. Every pre-2026-08-13
  ingest run hardcoded `language: 'English'` regardless of source
  evidence (see the same `bulk-ingest-fabricated-defaults-2026` fix), and
  `journal.schema.json`'s `language` is a BCP-47 array shape the corpus's
  flat string never matched anyway — there is no faithful mapping to
  carry through even where the corpus value happens to be right.
- **`country` is re-validated as ISO 3166-1 alpha-2**, not carried
  through blindly. Caught for real, not hypothetically: **5 of the 2,177
  corpus records carry a MARC country code instead of ISO** (`XXK`
  twice, `ENK` twice, `XXU` once — MARC's forms for "England, United
  Kingdom" ×2 and "United States" respectively, apparently leaked through
  from OpenAlex's `country_code` field on those specific sources).
  `validateIsoCountryCode()` (added in posi-engine's
  `bulk-ingest-fabricated-defaults-2026`, reused here) drops all five to
  `null` rather than writing a non-ISO value into a canonical record.

## Result

```
Registry unique posi_id:                                26,387
Canonical records before this run:                      24,205
Materialized this run:                                    2,177
Canonical records after:                                 26,382
Superseded old ids (expected no record):                     11
Documented excluded ids (expected no record):                  1
Unexplained gap (no corpus match):                              0
Final gate — registry id without canonical record:              0
```

`26,382 + 11 + 1 = 26,394` — 7 more than the registry's 26,387 unique
ids because a handful of `superseded-ids.csv`/`excluded-identities.csv`
entries reference ids that, on inspection, *do* already have a canonical
record too (the exclusion/supersession documentation existing doesn't
mean a record was never written — some were written before the
documentation was added, or independently of it). Every registry id
either has a canonical record, is a documented supersession, or is a
documented exclusion — no id falls through all three.

## Reproducibility

Full schema-shape validation (required fields, `id`/ISSN regex patterns,
`status`/`provenance.source` enums, `additionalProperties: false` key
allow-lists per journal.schema.json, ISO country format) run against all
2,177 output records: 0 errors. Cross-checked every output id against
`journals/core/**` and every other `journals/discovered/*.jsonl` file:
0 duplicates.

```
node posi-engine/scripts/materialize-publisher-expansion-canonical-records-2026.mjs \
  --registry registry/journal-id-map.csv \
  --core-dir journals/core \
  --discovered-dir journals/discovered \
  --benchmark corpus/global-benchmark.json \
  --excluded registry/excluded-identities.csv \
  --superseded registry/superseded-ids.csv \
  --out journals/discovered/publisher-expansion-2026.jsonl
```

The script excludes its own `--out` filename when scanning
`journals/discovered/` for already-existing ids, so re-running it against
a directory that already has this run's output regenerates the same
2,177 records deterministically rather than seeing them as "already
covered" and silently writing an empty file (caught mid-task: an earlier
version without this exclusion did exactly that on a second run, before
the country-code fix above was added — re-run from scratch afterward,
verified identical record count).

## What this does NOT do

- Does not touch `corpus/global-benchmark.json`, `registry/journal-id-map.csv`,
  or `initial-journal-migration-2026.jsonl` — read-only against all three.
- Does not backfill `issn_online`/`language`/`country` on the *existing*
  4,289 `corpus/global-benchmark.json` records — those keep whatever the
  original (pre-fix) ingest wrote. Only this run's own newly-written
  canonical records get the corrected `country` value and `null`
  `language`.
- Does not assign PSC classification, evidence, lifecycle, or rating data
  — every materialized record has `classification: null`, `coverage: null`,
  `selection: null`, matching `status: "discovered"` (found, not reviewed).
