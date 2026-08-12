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
`journals/discovered/`). This corpus's ~1,030 records never needed that
review process — they have no duplicate-identity problem (no auto-discovery,
no title/publisher fuzzy matching involved) — so their identity migration
onto `POSI-J-######` (see below) was a straight ISSN-L resolution pass, not a
dedupe review.

**These files (`core-collection.json` / `global-benchmark.json`) themselves
are untouched by that migration** and keep their existing `j-<code>` ids and
`journal_code` slugs (e.g. `j-grhas` / `grhas`) — the website still routes on
`journal_code`, and this repo's migration doesn't touch the website repo.
What changed instead: every record here now also has a canonical,
permanent-id counterpart under `journals/core/<shard>/<POSI-J-id>.json`
(PJR-SPEC.md § 4 sharding), resolved via a live OpenAlex `/sources` ISSN
singleton lookup, the same free/unauthenticated approach used for the
initial journal migration and the ShowJCR cross-check tool. Of the 1,031
records (31 `core-collection.json` + 1,000 `global-benchmark.json`):

- **1,031 of 1,031 resolved cleanly** — 0 flagged for manual identity
  review. 157 already had a `POSI-J-######` id (the same journal already
  existed in the big auto-discovered pool — e.g. `j-grhas` resolves to the
  same `POSI-J-000001` as GRHAS's entry in `journals/discovered/`, since
  Panorama Scholarly Group's own journals were swept up by that pool's broad
  crawl too); the registry's "resolve against `registry/journal-id-map.csv`
  before minting" rule (PJR-SPEC.md § 12) means those got the *existing* id,
  not a new one. The remaining 874 got a newly minted id, continuing from
  the registry's actual next-available sequence number (verified against
  the live registry at migration time, not assumed).
- Nearly all of those resolved at full ISSN-L confidence via a live OpenAlex
  lookup. A small number of records (2 in `core-collection.json` — two very
  recently launched journals not yet crawled by OpenAlex; 1 in
  `global-benchmark.json`, resolved instead via a direct OpenAlex source-id
  lookup since it had no ISSN on file) minted on a lower-priority identity
  tier per the same registry priority order (`issn_pair` or `openalex`,
  never a fabricated `issn_l`) — their `journals/core/` record's
  `identifiers.issn_l` is honestly left `null` rather than guessed.
- The pre-migration `j-<code>` id is preserved on the new record as
  `provenance[].source_record_id` (`source: "posi_curation"`) — the same
  place/shape the initial journal migration already used, not a new schema
  field. Since `journal_code` is always the `id` value with its `j-` prefix
  stripped (verified with zero exceptions across all 1,031 records), this
  alone is enough to recover `journal_code` losslessly if a future website
  migration needs the mapping.
- `journals/core/` records from `core-collection.json` get `status:
  "indexed"` (passed POSI Core Collection admission review, per the schema's
  own definition of that status) with the corresponding registry rows; ones
  from `global-benchmark.json` get `status: "discovered"` — **not**
  `"indexed"`, since (as below) this corpus is explicitly never a POSI
  admission candidate, and `"discovered"` is the schema's own honest label
  for "identity resolved, not admission-reviewed."
- Rich fields specific to this corpus's own shape (`pqf`, `early_stage_rating`,
  `psc_category`/`psc_confidence`, `metadata_quality_score`,
  `transparency_score`, etc.) are **not** carried into the `journals/core/`
  record — `schema/journal.schema.json` has no fields for them (same
  omission the initial journal migration made for its own source data).
  `core-collection.json` / `global-benchmark.json` remain the source of
  truth for those; `journals/core/` is the identity layer only.

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
