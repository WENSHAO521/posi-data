# OpenAlex Enrichment Audit v0.2

This audit adds **OpenAlex identity evidence** on top of
[Initial Journal Migration Audit v0.1](../initial-journal-migration/) — it
does not merge, curate, or assign ids. See `posi-engine`'s
[src/migration/openalex-enrich.mjs](https://github.com/WENSHAO521/posi-engine/blob/master/src/migration/openalex-enrich.mjs)
and [rescore-duplicates.mjs](https://github.com/WENSHAO521/posi-engine/blob/master/src/migration/rescore-duplicates.mjs)
for the code that produced this, and `PJR-SPEC.md § 12` for the identity/
dedup methodology this fits into.

## Why a singleton lookup, not search

OpenAlex's `GET /sources/issn:{issn}` singleton endpoint resolves one exact
ISSN to at most one source — no ranking, no fuzzy matching, nothing to
second-guess. Title/name search was deliberately not used anywhere in this
pass: a search-based "best match" is a guess, and guesses are exactly what
"conflict beats match" exists to keep out of identity resolution.

## Headline numbers

| Metric | Value |
|---|---|
| Candidate entities processed | 23,819 |
| Unique ISSNs queried | 36,913 |
| Verified (single journal-type source, all ISSNs agree) | 23,674 (99.4%) |
| Not found | 45 |
| Partial match | 5 |
| Source type conflict | 17 |
| Multiple sources (conflicting evidence, not resolved) | 1 |
| Review required (lookup failure, needs re-run) | 77 |
| Possible-duplicate groups re-scored | 171 |
| — confirmed same by OpenAlex | 164 |
| — confirmed distinct by OpenAlex | 5 |
| — still inconclusive | 2 |

Full detail in [`audit-summary.md`](audit-summary.md) / `audit-summary.json`.

## Files in this directory

| File | Contents |
|---|---|
| `audit-summary.md` | Human-readable report (status definitions, methodology notes) |
| `audit-summary.json` | Machine-readable version of the same |
| `manifest.json` | Provenance: input entities/possible-duplicates source, generator commit, release asset checksums |
| `rescored-possible-duplicates.csv` | All 171 v0.1 possible-duplicate groups with their new rescoring verdict |

## Bulk artifact (not committed to Git history)

`candidate-enrichment.jsonl` (23,819 rows — one per v0.1 candidate entity:
status, matched OpenAlex source(s), matched ISSNs) is published gzipped as a
release asset on
[`openalex-enrichment-audit-v0.2`](https://github.com/WENSHAO521/posi-data/releases/tag/openalex-enrichment-audit-v0.2),
per `posi-data`'s large-file policy. Checksum is in `manifest.json` and the
release's own `SHA256SUMS` asset.

## Known gaps this audit surfaces (not blockers, but tracked)

- **77 `review_required` candidates** are lookup failures, not identity
  ambiguity — a re-run against just those ISSNs (once transient
  network/rate-limit conditions clear) should resolve most of them into one
  of the other statuses.
- **17 `source_type_conflict` candidates** have an ISSN that resolves to a
  non-`journal` OpenAlex source (conference proceedings, book series,
  repository). Worth a manual look before the next audit — some may be
  legitimate (a journal that also has a conference-proceedings ISSN) and
  some may be miscatalogued upstream, on either side.
- **2 possible-duplicate groups remain `manual_review`.** OpenAlex evidence
  alone wasn't conclusive for these; they need a human to look at the
  underlying journals directly.
- **Raw per-ISSN OpenAlex API responses are not published.** Only the
  classified, per-candidate result is. The local run cache is not
  reproducibility-critical (re-running against a cold cache re-queries
  OpenAlex live), but it does mean this audit reflects OpenAlex's data as of
  `generated_at`, not a frozen, independently-verifiable API snapshot.
