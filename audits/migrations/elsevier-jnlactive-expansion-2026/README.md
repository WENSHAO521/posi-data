# Elsevier jnlactive.csv Expansion 2026

Adds the Elsevier journals listed in [`jnlactive.csv`](../../../jnlactive.csv)
(Elsevier's own active-journals export) that were not yet in the Global
Benchmark Collection, enriched via OpenAlex's free per-ISSN singleton
lookup, and given real, newly-minted `POSI-J` identities.

## Result

```
Global Benchmark Collection: 1000 -> 4111 records

jnlactive.csv total rows:                 3433
Already in Global Benchmark (by ISSN):     312
Newly ingested this run:                  3121

Duplicate resolution:
  Old (pre-existing) records removed
    (superseded by a corrected jnlactive.csv duplicate):    -7   -> 993 base
  New records removed
    (literal duplicate rows within jnlactive.csv itself):   -3   -> 3118 real new records

Final: 993 (surviving originals) + 3118 (real new records) = 4111

Of the 3118 real new records:
  OpenAlex-enriched (country/openalex_source_id/article_count): 3078
  Not found in OpenAlex (still ingested, fields left null/0):      40

Identity:
  Reused existing registry entry: 1931 (already-reserved from the
                                          Aug-12 identity migration)
  Newly minted POSI-J ids:        2180
  Registry: 24,205 -> 26,385 rows

Final corpus/global-benchmark.json: 4111 / 4111 records have a posi_id.
Duplicate posi_id assignments: 0.
```

## A real bug was found and fixed mid-process — not shipped

The first ingestion attempt used a naive `line.split(',')` CSV parser.
`jnlactive.csv` has quoted titles containing commas (e.g. `"Chaos,
Solitons & Fractals",0960-0779,...`), which a naive split shifts every
column after — either producing an obviously-empty ISSN (78 records
silently dropped from identity resolution) or, worse, could have read a
neighboring column's value into the ISSN field undetected. **Caught in
review before anything was minted or committed** — rolled back cleanly
(nothing had been pushed), and re-run using the repository's own existing,
tested RFC4180-correct parser (`src/showjcr/csv.mjs`'s `parseCsv()`)
instead of a new one-off parser. The already-merged Elsevier
`website_url` fix (`elsevier-website-fix-2026`, posi-data#8) was checked
against this and confirmed **not** affected — the one record it missed due
to the same naive-parsing limitation was a case where matching silently
failed (safe: no wrong write), not a case of a wrong URL being written.

Confirms the value of this: after switching to the correct parser, all
2180 "unresolved, needs manual review" entities from the buggy run
resolved cleanly on the corrected run (0 skipped) — they had valid ISSNs
all along; the parser was reading the wrong column.

## Duplicates found and resolved

Two categories, found by the standard `dedupe.mjs` pipeline (same code
used for the real 23,331-record migration) plus a title+ISSN pass over
the newly-ingested records specifically:

**7 records: an existing Global Benchmark journal duplicated by this
ingestion, under a different (and, per Elsevier's own current export,
more correct) ISSN.** E.g. the existing "The Lancet" record carried ISSN
`0099-5355` (not The Lancet's actual, well-known ISSN); jnlactive.csv
lists it under `0140-6736`. **Platform-owner decision: keep the new
jnlactive.csv record, remove the old one** — Elsevier's own current export
is more authoritative than the original benchmark seed data, and the new
record already carries the corrected `website_url` this session's earlier
work established. The 7 old records removed:

```
The Lancet (was 0099-5355)
Journal of Environmental Chemical Engineering (was 0169... variant ISSN)
Biochimie
Transportation Research Procedia
Transplantation and Cellular Therapy
Bone
European Journal of Obstetrics & Gynecology and Reproductive Biology
```

**3 records: literal duplicate rows within jnlactive.csv itself** (same
title, same ISSN, appearing twice) — "Blood Red Cells & Iron", "Journal of
Strategy & Innovation", "CMI Communications". Second occurrence of each
removed; no judgment call needed (identical identity, mechanically safe).

**6 pairs (12 records) left deliberately unmerged — flagged, not
resolved.** Same title/publisher, but a different ISSN each, both from
jnlactive.csv itself (not an old-vs-new case, so the platform owner's
"keep the new one" rule doesn't apply). Likely journal renames or
dual-language editions Elsevier's export lists as separate rows — e.g.
"Mutation Research" vs "Mutation Research - Fundamental and Molecular
Mechanisms of Mutagenesis" (a known real Elsevier rename), or "Revista
Española de Medicina Legal" vs "Spanish Journal of Legal Medicine" (looks
like a dual-language ISSN pair). One pair, "Chemical Engineering Research
and Design" vs "Process Safety and Environmental Protection", is less
obviously a duplicate at all by title — worth a human check on whether
that's a genuine OpenAlex Source-id data quirk rather than a duplicate.
**Both records in each pair were kept, each got its own newly-minted
posi_id** — the dedupe pipeline's existing "conflict beats match" rule
(never auto-merge on disagreeing ISSN evidence) applied as designed. See
[ambiguous-pairs-needs-review.json](./ambiguous-pairs-needs-review.json)
for the full list with ISSNs.

## Files

- `new-journals-mapping.csv` — all 3118 ingested records (legacy id,
  posi_id, title, ISSN, OpenAlex id, article count, minted-vs-reused).
- `ambiguous-pairs-needs-review.json` — the 6 unmerged pairs above.
- `not-found-in-openalex.csv` — the 40 records ingested with no OpenAlex
  match (identity still resolved via ISSN alone; country/article_count
  left null/0).

## What this does NOT do

- Does not run PSC classification, Evidence ETL, PCS, or any AJR scoring
  for these 3111 new records — identity + basic metadata only, matching
  the same phased approach used for Core Collection and the original
  1000-journal benchmark set.
- Does not touch Core Collection or any other corpus file.
