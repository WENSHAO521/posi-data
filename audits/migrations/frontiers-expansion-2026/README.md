# Frontiers Expansion 2026

Cross-checks and expands the Global Benchmark Collection against
[`frontiers-titlelist-web-2026.csv`](../../../source-lists/frontiers-titlelist-web-2026.csv)
(Frontiers Media's own title list, distributed via the Swiss Academic
Libraries consortium — "Last update: 23.02.2026/AKO"). Two independent
passes, mirroring `elsevier-website-fix-2026` and
`elsevier-jnlactive-expansion-2026` respectively.

**Rebased and re-run against the clean Elsevier baseline.** This branch
originally ran against the flawed 4111-record Elsevier corpus before that
expansion's second-round review (see
`audits/migrations/elsevier-jnlactive-expansion-2026/README.md`). After
that review resolved 6 hard-conflict pairs and fixed 7 orphaned ids, this
branch was rebased onto the corrected 4106-record baseline and the entire
Frontiers ingestion was **re-run from scratch** (not carried forward as a
rebased patch) using `posi-engine`'s now-fixed ingest/mint scripts.

## Pass 1 — website_url fix

`scripts/fix-frontiers-website-2026.mjs` matched the 20 existing
Frontiers-publisher Global Benchmark records to the CSV by ISSN. All 20
had a stale URL — every one used an old `frontiersin.org` link pattern
that Frontiers has since consolidated to
`https://www.frontiersin.org/journals/<slug>`. Full list:
[`website-url-fixes.json`](./website-url-fixes.json). Identical result to
the pre-rebase run (none of the 20 Frontiers records were touched by the
Elsevier rewrite).

## Pass 2 — new journal ingestion

```
CSV total rows:                          234
  rows with a valid-format ISSN:         203
  rows skipped (invalid ISSN):             1
already in Global Benchmark (by ISSN):    20
new records ingested:                    183
```

All 183 resolved cleanly against OpenAlex (0 not-found) — identical to
the pre-rebase run.

### The "Coming Soon" placeholder (unchanged from the original pass)

Row 97 of the CSV, `Frontiers in Fish Science,Coming Soon,...`, has no
real ISSN (the journal hasn't launched yet). Both
`fix-frontiers-website-2026.mjs` and `ingest-frontiers-2026.mjs` validate
the ISSN column against `/^\d{4}-\d{3}[\dXx]$/` rather than just checking
for a non-empty string, so this row is cleanly skipped rather than
written into the corpus as a fake ISSN.

### Identity resolution against the clean baseline

Ran `remap-benchmark-identity-2026.mjs` against the full 4289-record
corpus (4106 clean Elsevier baseline + 183 new Frontiers records) and the
26,385-row registry:

```
matched (reused existing POSI-J id):    4287
unresolved (genuinely new to registry):    2
internal hard conflicts:                   2
internal possible duplicates:              0
```

The 2 hard conflicts are **both pre-existing from the Elsevier expansion**
(Chemical Engineering Research and Design / Process Safety and
Environmental Protection, and Revista Española de Medicina Legal /
Spanish Journal of Legal Medicine) — both already-reviewed platform-owner
decisions to keep as independent ids (see the Elsevier audit's
`hard-conflict-pairs-resolved.json`). No new Frontiers-specific conflicts,
and the "Clinical Traditional Medicine and Pharmacology" zero-evidence
duplicate from the Elsevier review is gone from this count since that
record was already excluded from the baseline.

The 2 unresolved entities are unambiguous — real ISSN + real OpenAlex
Source ID, no registry hit, no conflict:

| Title | ISSN | OpenAlex ID | Minted |
|---|---|---|---|
| Advanced Optical Technologies | 2192-8584 | S2764547716 | `POSI-J-026386` |
| Frontiers in Ceramics | 2813-611X | S4387287337 | `POSI-J-026387` |

**A live proof of the mint-script fix**: during this run, the mint step
was accidentally invoked twice against the same input (an operator
mistake — a stray `cp` overwrote the freshly-minted corpus with a
pre-mint snapshot). Re-running `mint-elsevier-jnlactive-2026.mjs` a
second time correctly detected that `registry/journal-id-map.csv` already
had entries for both identities (from the first, successful mint) and
**reused** `POSI-J-026386` / `POSI-J-026387` instead of minting a second
pair of ids for the same two journals — registry stayed at 26,387 rows,
not 26,389. This is exactly the "re-resolve against the CURRENT registry
before minting" behavior added in the Elsevier review's fix #4, now
verified in a real (if accidental) double-run, not just by unit test.

## Result

```
Global Benchmark:  4106 -> 4289  (+183 new, +20 website_url fixes)
Registry:         26385 -> 26387 (+2 minted, 4287 reused)
```

No duplicate `posi_id` assignments, no records left without a `posi_id`.

## Files

- [`website-url-fixes.json`](./website-url-fixes.json) — all 20 URL fixes applied.
- [`new-journals-mapping.csv`](./new-journals-mapping.csv) — the 183 newly-ingested records.
- [`newly-minted-entities.json`](./newly-minted-entities.json) — the 2 entities that needed a brand-new POSI-J id.
- [`mint-summary.json`](./mint-summary.json) — final registry/benchmark counts.
- [`manifest.json`](./manifest.json) — machine-readable summary.

## Reproducibility

```
node posi-engine/scripts/fix-frontiers-website-2026.mjs \
  --csv source-lists/frontiers-titlelist-web-2026.csv \
  --benchmark corpus/global-benchmark.json --out <dir> --apply

node posi-engine/scripts/ingest-frontiers-2026.mjs \
  --csv source-lists/frontiers-titlelist-web-2026.csv \
  --benchmark corpus/global-benchmark.json --out <dir>

node posi-engine/scripts/remap-benchmark-identity-2026.mjs \
  --registry registry/journal-id-map.csv \
  --benchmark corpus/global-benchmark.json --out <dir>

node posi-engine/scripts/mint-elsevier-jnlactive-2026.mjs \
  --registry registry/journal-id-map.csv \
  --benchmark corpus/global-benchmark.json \
  --resolved <remap-out>/resolved.json \
  --unresolved <remap-out>/unresolved-manual-review.json \
  --out <dir>
```

Must be run against `elsevier-jnlactive-expansion-2026`'s corrected
4106-record baseline (posi-data#9's rewrite), not the original flawed
4111-record corpus.
