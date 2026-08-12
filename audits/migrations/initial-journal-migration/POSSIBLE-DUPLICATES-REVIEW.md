# Possible-duplicates review — 171 groups, real ISSN-L evidence

`audit-summary.md`'s "Next steps" #2 asked for `possible-duplicates.csv`'s
171 title+publisher matches to be reviewed with real identity evidence, not
merged on string similarity alone. This is that review.

## Method

For every one of the 171 rows, each side's legacy ISSN(s) were looked up
live against OpenAlex's free singleton endpoint
(`GET /sources/issn:{issn}`, no auth, `mailto=` set) — the same approach
already used by `../openalex-enrichment/` (v0.2), re-run independently here
rather than trusted blindly (see "Relationship to the v0.2 enrichment audit"
below for why, and what it found).

- **Both sides resolve to the same `issn_l`** (or, in one case, the same
  OpenAlex Source ID when `issn_l` itself is null upstream — see below) →
  `confirmed_same`. Merged into one candidate entity before minting.
- **Both sides resolve, to different `issn_l` values** → `confirmed_distinct`.
  Kept as two separate entities/ids — a similar title and publisher string is
  not evidence of one journal, and OpenAlex's identity data confirms these
  are two real, different journals.
- **Anything else** (a lookup failure, no OpenAlex source found, or one
  side's own ISSNs resolving to internally conflicting `issn_l` values) →
  `inconclusive`, kept separate, flagged for human review of the *possible
  merge* specifically (neither side's own individual identity is in doubt —
  each already has its own valid ISSN from the source data).

No title/name search was used anywhere — every lookup is a singleton ISSN
lookup, per `registry/README.md`'s explicit exclusion of title/publisher
similarity as identity evidence.

Full per-row evidence (every ISSN queried, the OpenAlex response, resolved
`issn_l`) is in `possible-duplicates-resolution-evidence.json`. The summary
table is `possible-duplicates-resolution.csv`.

## Result

| Verdict | Count |
|---|---:|
| `confirmed_same` (merged) | 166 |
| `confirmed_distinct` (kept separate) | 5 |
| `inconclusive` (kept separate, flagged) | 0 |
| **Total** | **171** |

All 171 rows reached a real, evidenced conclusion. None were forced through
on a guess.

### The 5 confirmed-distinct pairs

Same title+publisher string, genuinely different journals (different
`issn_l` on each side, confirmed live):

| Title | Publisher | issn_l (side A) | issn_l (side B) |
|---|---|---|---|
| Psychological-Educational Studies | Moscow State University of Psychology and Education | 2587-6139 | 2074-5885 |
| Jurnal Teknik Industri | Petra Christian University | 1978-1431 | 1411-2485 |
| The Pan-American Journal of Ophthalmology | Medknow | 2666-4909 | 2219-4665 |
| Jurnal Manajemen | Tarumanagara University | 1410-3583 | 2086-7840 |
| Jurnal Pendidikan Ilmu Sosial | Muhammadiyah University Press | 0854-5251 | 1412-3835 |

Two of these (the "Jurnal ..." Indonesian-language pairs) are a useful
reminder of exactly why title+publisher was never trusted as identity
evidence on its own: generic institutional-journal naming conventions
("Jurnal Manajemen" = "Management Journal") combined with a shared
publisher string produce exactly this kind of false-positive candidate.

### One case resolved via OpenAlex Source ID rather than issn_l

"Territorio Italia" / Agenzia delle Entrate (`CAND-022337`/`CAND-022345`):
both legacy ISSNs (`2499-2674`, `2499-2666`) resolve to the identical
OpenAlex source (`S2736437162`, same `display_name`, same full `issn` array
including both), but that source's own `issn_l` field is null upstream on
OpenAlex (not every OpenAlex source has one populated). Registry priority
tier 3 (OpenAlex Source ID) is the correct fallback exactly for this case —
see `registry/README.md` — so this was still treated as `confirmed_same`,
just on tier-3 evidence instead of tier-1.

## Relationship to the v0.2 enrichment audit

`../openalex-enrichment/` (v0.2, published 2026-08-08) already re-scored
these same 171 rows and reached 164 `openalex_confirms_same` / 5
`openalex_confirms_distinct` / 2 `manual_review`. This review was run
independently anyway rather than simply citing v0.2's numbers, and turned
up real differences worth recording:

- Spot-checked a sample of v0.2's `verified` classifications against live
  OpenAlex before trusting it further — every spot-check matched exactly
  (same source id, same `issn_l`, same `issn` array), including the
  `SHA256SUMS`-verified `candidate-enrichment.jsonl` release asset itself.
  v0.2 is real, accurate work, not a placeholder.
- The 2 rows v0.2 left as `manual_review` were lookup failures at the time
  ("Open Engineering" and "Journal of Electromagnetic Engineering and
  Science" — see v0.2's own README: "77 review_required candidates are
  lookup failures, not identity ambiguity ... a re-run ... should resolve
  most of them"). Re-querying them live here, they both resolve cleanly to
  a single shared `issn_l` — both are now `confirmed_same`, exactly the
  outcome v0.2's own README predicted.
- The "Territorio Italia" case above was actually mis-scored on a first
  pass of this review's own script too (its `issn_l`-only comparison logic
  initially reported it `inconclusive` because OpenAlex's `issn_l` for that
  source is null) — caught by diffing this review's results against v0.2's
  (which had it as `openalex_confirms_same`) before finalizing, then fixed
  by using OpenAlex Source ID as the tier-3 fallback. Recorded here as a
  methodology note: **cross-checking two independent runs against each
  other, not just against live-API spot checks, caught a real bug.**

Net effect versus v0.2: 166 confirmed_same (was 164), 0 inconclusive (was 2).

## A duplicate class the original 171-row list never caught

Attaching each entity's confirmed `issn_l` (from this review, for the 342
entities in the 171 rows, and from v0.2's enrichment for the other ~23,477
entities that were never flagged as a *possible* duplicate at all) and then
re-grouping the full 23,819-entity corpus by that `issn_l` surfaced **318
more duplicate groups (322 entities absorbed)** that `possible-duplicates.csv`
never listed — because their legacy titles or publisher strings didn't match
closely enough for the original title+publisher heuristic to flag them (a
journal rename, a translated title, an English/local-language title pair, a
missing publisher field on one side, etc.), even though they are the exact
same journal by `issn_l`.

Every one of these is a *print/online ISSN pair or a real title change*
recorded as two separate legacy records — e.g. Springer Nature's "Palgrave
Communications" renaming to "Humanities and Social Sciences Communications"
(`issn_l 2055-1045`), or "Journal of Yeungnam Medical Science" carrying three
distinct ISSNs across its publication history (`issn_l 1225-7737`, live-
verified: all three resolve to the identical OpenAlex source). See
`post-enrichment-duplicate-regroup.csv` for the full list, and
`REPRODUCIBILITY-VERIFICATION.md` / the merge audit trail for how these were
found. Unlike the 171-row list, this class was discovered and merged
automatically because it rests on the same strong signal (shared `issn_l`)
that the registry's own tier-1 identity priority already trusts without
human review — string-similarity evidence was never involved.

## Invalid identifiers (`invalid-identifiers.csv`, 4 rows)

All 4 are ISSN checksum failures on one field (`issn_print` in 3 rows,
`issn_online` in 1), with a *valid* ISSN present on the other field in every
case. The dry-run pipeline already excludes the checksum-failing ISSN from
that candidate's `issn_set` (verified directly in `candidate-entities.jsonl`
— each of the 4 resulting entities carries exactly one ISSN, the valid one)
so none of these ever blocked identity resolution or minting.

Live OpenAlex lookups on each record's *valid* ISSN turned up something
worth recording: in all 4 cases, the checksum-failing ISSN is **also**
listed in OpenAlex's own `issn` array for that exact same source — i.e. it
is a real, upstream-registered ISSN for the right journal, not a random
transcription error introduced by this corpus. It just happens to fail the
standard ISO 3297 mod-11 check-digit formula, which does occasionally happen
with real assigned ISSNs (a data-quality quirk in the ISSN system itself,
propagated through whatever registry/publisher metadata OpenAlex ingested
this from).

| legacy_id | field | value (fails checksum) | OpenAlex confirms it belongs to |
|---|---|---|---|
| `j-disc-issn-1405-9193` | issn_print | 2428-4881 | S2898087311, "Cuestiones Constitucionales..." (issn_l 1405-9193) |
| `j-disc-issn-1049-8931` | issn_print | 1234-988X | S191377590, "International Journal of Methods in Psychiatric Research" (issn_l 1049-8931) |
| `j-disc-issn-1728-4414` | issn_print | 1728-5303 | S4210187593, "Vienna Yearbook of Population Research" (issn_l 1728-4414) |
| `j-disc-issn-1806-9652` | issn_online | 1806-9652 | S4210234157, "Revista de Biologia Neotropical..." (issn_l 1807-9652) |

**Not "corrected"** — no digit was guessed or changed. Each record mints
normally using its already-valid ISSN (tier 1, `issn_l`, since all 4 also
appear in the enrichment/regroup passes above); the checksum-failing value
stays exactly as recorded in the legacy source, just not carried into
`identifiers.issn_print`/`issn_online` on the minted record (matching what
the dry-run pipeline already did). None of the 4 needed to be left
unresolved.
