# Elsevier jnlactive.csv Expansion 2026

Adds the Elsevier journals listed in [`jnlactive.csv`](../../../source-lists/jnlactive.csv)
(Elsevier's own active-journals export) that were not yet in the Global
Benchmark Collection, enriched via OpenAlex's free per-ISSN singleton
lookup, and given real, newly-minted `POSI-J` identities.

**This is a rewrite of the original pass.** A rigorous second-round review
(2026-08-12) found real data-integrity gaps in both the ingest/mint
scripts and the identity-conflict handling; this document and the
corpus/registry it describes reflect the corrected, re-run result. The
original pass's writeup is preserved below under "What the first pass got
wrong" for the audit trail.

## Result (clean re-run)

```
Global Benchmark Collection: 1000 -> 4106 records

jnlactive.csv total rows:                 3433
Already in Global Benchmark (by ISSN):     312
Newly ingested this run:                  3121

Removed after ingestion:
  Old (pre-existing) records superseded by a
    corrected jnlactive.csv ISSN:                        -7
  New-vs-new pairs: old/predecessor name superseded
    by the confirmed-current name (renames):              -4
  Literal duplicate rows within jnlactive.csv itself:     -3
  Zero-evidence "ghost" duplicate (see below):            -1
                                                          ----
  Total removed:                                         -15

Final: 993 surviving originals (1000 - 7 superseded) + 3113 surviving
  new records (3121 ingested - 3 literal duplicates - 1 zero-evidence
  exclusion - 4 renamed-old-side removed) = 4106.

Identity:
  Reused existing registry entry (registry unchanged by this rewrite,
    still permanent/append-only):                      4118 of 4121
  Newly minted POSI-J ids this run:                        0
    (all identities from the original pass's mints are still valid,
     permanent registry rows -- nothing needed re-minting)

Final corpus/global-benchmark.json: 4106 / 4106 records have a posi_id.
Duplicate posi_id assignments: 0.
```

## What the second-round review found and fixed

### 1. Four script-level data-integrity bugs (posi-engine#5)

- `existingIssns` was built from `r.issn_online || r.issn_print` — a
  record with both ISSNs set would only block a re-ingest on whichever one
  `||` happened to pick. **Verified inert on this dataset** (`issn_print`
  is null on all 4294 records that existed at the time of the check) but a
  real landmine for any future source with print ISSNs — fixed regardless.
- OpenAlex transient errors (429/5xx/timeout/network error) were written
  into the corpus as if they were a clean 404 absence. **Verified 0
  transient errors occurred in either the original or the re-run** (both
  report `openalex_error: 0`) — no data was actually corrupted by this,
  but the code allowed it, so it's fixed.
- `--concurrency` had no positive-integer validation (a `0` would stall
  the batch loop indefinitely).
- `mint-elsevier-jnlactive-2026.mjs` re-implemented its own ad hoc mint
  loop instead of using the already-tested `resolveOrMintIds()` from
  `src/migration/mint.mjs`, so it never re-checked the registry
  immediately before minting — a stale `unresolved-manual-review.json` or
  an accidental re-run could have double-minted. Rewritten to delegate to
  the tested function.

**A clean re-run with the fixed scripts against the pre-migration 1000
baseline reproduced the ingestion identically** (found 3081, not-found
404 40, transient errors 0 — same as the original pass), confirming the
first three fixes were behaviorally inert on this specific dataset. See
`posi-engine`'s own commit for the code and
`test/migration-bulk-ingest-helpers.test.mjs` for regression coverage.

### 2. The 6 "ambiguous pairs" were never actually gated — now resolved

`dedupe.mjs`'s "conflict beats match" rule correctly refuses to
auto-merge two records that share an OpenAlex Source id but carry
non-overlapping ISSN evidence — but it does **not** block either side
from independently resolving/minting. The original pass's audit reported
"6 hard conflicts, left unmerged" while the corpus had already silently
given each side its own permanent `POSI-J` id. If any of those pairs were
actually the same real-world journal, that's two permanent ids minted for
one journal — a real identity-integrity gap, not a cosmetic one.

Researched each pair via OpenAlex Source records (issn_l, issn array,
alternate_titles) and Crossref publication-date chronology (earliest/latest
work per ISSN — a clean rename shows one ISSN's publication history
stopping right where the other's starts; two independent journals show
both continuously active in parallel with no handoff). Full evidence and
verdicts: [`hard-conflict-pairs-resolved.json`](./hard-conflict-pairs-resolved.json).

| Pair | Verdict | Action |
|---|---|---|
| Chemical Engineering Research and Design / Process Safety and Environmental Protection | Two independent, continuously-active journals since 1996 (9941 vs 10395 Crossref works, no handoff) sharing one OpenAlex Source id — an upstream OpenAlex data quirk, not a duplicate | Both ids kept, documented so nothing auto-merges them later |
| Progrès en Urologie / The French Journal of Urology | Rename, clean handoff at 2024-01 | Old removed, superseded |
| Mutation Research / Mutation Research - Fundamental and Molecular Mechanisms of Mutagenesis | ISSN retirement in 2017, general title folded into the section-specific ISSN | Old removed, superseded |
| Research in Autism / Research in Autism Spectrum Disorders | Rename, clean handoff at 2025-02 | Old removed, superseded |
| Revista Española de Medicina Legal / Spanish Journal of Legal Medicine | Both ISSNs concurrently active 2016-2026 (559 vs 249 works, no handoff) — a bilingual co-edition, not a rename | **Platform owner decision (2026-08-12): kept as 2 independent ids** despite the shared OpenAlex Source, since the article sets are not identical |
| Revista de Psiquiatría y Salud Mental / Spanish Journal of Psychiatry and Mental Health | Rename, clean handoff at 2023-01 | Old removed, superseded |

### 3. The 7 "old record removed" ISSN corrections were silently orphaning permanent ids

Removing the old (wrong-ISSN) record without recording anything meant its
`posi_id` became a dangling registry row: nothing in the corpus points to
it, nothing explains where it went. Confirmed this was systemic across
**all 7** of the original pass's removals, not just an isolated case — each
one's old `posi_id` is still a live row in `registry/journal-id-map.csv`,
distinct from the surviving record's `posi_id` (which resolved via the
corrected ISSN to an entirely different, pre-existing registry entry from
the original 24,205-row migration).

**Fix**: new `registry/superseded-ids.csv` (`old_posi_id`,
`superseded_by_posi_id`, `reason`, `date`) — append-only, existing
registry rows untouched. See `registry/README.md` for the full design.
Combined with the 4 confirmed renames from the hard-conflict review above,
**11 total supersession entries** now exist.

### 4. A new zero-evidence duplicate, found during the clean re-run's dedupe pass

Re-running dedupe against the pre-cleanup 4121-record corpus (before the
15 removals) surfaced an 8th possible-duplicate group beyond the one
already known: two records both titled "Clinical Traditional Medicine and
Pharmacology" — `2097-3829` (real: OpenAlex Source `S5406978635`, 121
works) and `2950-5771` (`openalex_source_id: null`, `article_count: 0`).
Checked `2950-5771` directly against Crossref: **404, not registered at
all**. Same pattern as the Frontiers "Coming Soon" placeholder caught in
the Frontiers pass — no independent evidence this ISSN belongs to an
actual publishing journal. Excluded from the corpus (its `posi_id`,
`POSI-J-024583`, stays a permanent-but-unused registry row — not
"superseded," just insufficient evidence to include in a scored corpus
yet; flagged here for anyone re-checking once Elsevier's export updates).

### 5. Duplicate `posi_id` assignments in the clean re-run's remap output (expected, not a bug)

The clean re-run's remap step reported `duplicate_posi_id_assignments: 3`
before the literal-duplicate-row cleanup — confirmed these are exactly the
3 already-known literal duplicate CSV rows (same title, same ISSN, twice),
correctly unioned into one entity by `dedupe.mjs` and correctly given one
shared `posi_id`. Not a new problem; the second occurrence of each is
removed as before.

## Files

- [`hard-conflict-pairs-resolved.json`](./hard-conflict-pairs-resolved.json) — full evidence and verdict for all 6 pairs.
- [`new-journals-mapping.csv`](./new-journals-mapping.csv) — all 3113 surviving newly-ingested records (legacy id, posi_id, title, ISSN, OpenAlex id, article count).
- [`not-found-in-openalex.csv`](./not-found-in-openalex.csv) — the 40 records ingested with no OpenAlex match.
- [`removed-records.csv`](./removed-records.csv) — all 15 records removed from the corpus, with reason.
- `../../../registry/superseded-ids.csv` — the 11 supersession entries (not duplicated here; single source of truth lives in the registry).

## What the first pass got wrong (original writeup, for the audit trail)

The first ingestion attempt used a naive `line.split(',')` CSV parser,
caught and fixed before anything was committed — see git history on this
branch for that fix. The first pass then correctly identified the 7
ISSN-correction cases and 3 literal duplicates, but reported the 6
ambiguous pairs as "left unmerged, flagged" without recognizing that
`dedupe.mjs`'s design already let both sides mint independently — i.e.
"flagged" did not mean "gated." It also did not check whether the 7
removed records' old `posi_id`s remained resolvable. Both gaps are fixed
in this rewrite.

## What this does NOT do

- Does not run PSC classification, Evidence ETL, PCS, or any AJR scoring
  for these new records — identity + basic metadata only, matching the
  same phased approach used for Core Collection and the original
  1000-journal benchmark set.
- Does not touch Core Collection or any other corpus file.
- Does not yet address whether `is_external_benchmark: true` bulk-ingested
  records should be excluded from ranking-cohort eligibility by default —
  open item, tracked separately before any frontend sync.
