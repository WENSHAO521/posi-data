# Corpus — Core Collection & Global Benchmark

Canonical source for the two manually-curated journal sets: `core-collection.json`
(journals admitted through POSI's published editorial selection criteria — see
`PJR-SPEC.md`) and `global-benchmark.json` (the external AJR-validation corpus,
selected purely from OpenAlex's open signals — never a POSI admission
candidate, see `AJR-SPEC.md` § "Global Benchmark Collection").

## Why this is not `journals/`

`journals/core/` and `journals/discovered/` are reserved for the output of
`posi-engine`'s migration pipeline ([src/migration/](https://github.com/WENSHAO521/posi-engine/tree/master/src/migration)) —
stable `POSI-J-######` ids, resolved via the identity registry
(`registry/journal-id-map.csv`), after human review of the 171 flagged
possible-duplicate groups (see `audits/migrations/initial-journal-migration/POSSIBLE-DUPLICATES-REVIEW.md` —
that review is now done: 23,331 `POSI-J-######` ids minted into
`journals/discovered/`). This corpus's ~1,030 records still don't need that
process — they have no duplicate-identity problem (no auto-discovery, no
title/publisher fuzzy matching involved) and are migrated onto `POSI-J-######`
separately, as noted below. Using the same `journals/` location for both
would conflate a reviewed, permanent-id corpus with this one's own
not-yet-migrated `j-<code>` ids.

**These records keep their existing `j-<code>` ids and `journal_code` slugs**
(e.g. `j-grhas` / `grhas`) — not `POSI-J-######`. Migrating this corpus onto
the POSI-J schema is a distinct, larger future task, not bundled into this
move.

## Fields

Same shape as the website repo's `Journal` interface
(`src/lib/types.ts`) — `pqf` (editorial selection score), `early_stage_rating`
(AJR score, lifecycle eligibility, evidence coverage, provisional quartile),
`psc_category`/`psc_confidence` (subject classification), plus `source_group`
on `core-collection.json` entries only (`psg`/`indexed`/`shiharr`/
`other_indexed` — which original curation batch a journal came from, used by
a handful of website pages, e.g. the PSG-only conflict-of-interest list).

## Update workflow

Journal-scoring scripts (`rate-early-stage.mjs`, `classify-psc.mjs`,
`discover-benchmark-journals.mjs`, `rank-lifecycle.mjs`,
`sync-article-counts.mjs` — currently still living in the website repo's
`scripts/`, not yet moved here) should target these files going forward
instead of the website repo's local copies. The website repo vendors a
synced snapshot (`src/lib/core-collection.json` /
`src/lib/global-benchmark.json`) that's refreshed deliberately (a manual
sync + commit) rather than on every scoring run — this is what actually
reduces the website repo's commit-history growth; moving the canonical data
here only helps if the website stops re-committing the full corpus on every
re-rating pass.
