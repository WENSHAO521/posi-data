# Evidence

Journal-level and publisher-level evidence records feeding AJR-E/AJR-M's
Evidence Coverage model (AJR-SPEC.md § 6, `posi-engine/src/evidence-
coverage.mjs`). Produced by `posi-engine`'s Evidence ETL pipeline
(`src/evidence-fetch.mjs` / `src/evidence-page-discovery.mjs` /
`src/evidence-resolver.mjs` / `src/evidence-publisher-registry.mjs`,
orchestrated by `scripts/run-evidence-etl.mjs`), not hand-edited.

## Layout

```
evidence/
├── journals/<posi_id>.json      -- one evidence package per journal
└── publishers/<slug>.json       -- publisher-wide policy entries (AJR-SPEC.md § 8)
```

`journals/` is flat (not shard-prefixed like `journals/core/<shard>/`) for
now — fine at Core Collection + Global Benchmark scale (~1000 files); worth
revisiting if/when this extends to the full 24,205-record discovered
corpus.

## Journal evidence package shape

Each `journals/<posi_id>.json` holds one run's result: which pages were
fetched and their `fetch_status` (see `evidence-fetch.mjs`'s 8-value
taxonomy), a resolved evidence item per criterion (`evidence-coverage.mjs`'s
7-state model: `met`/`not_met`/`unknown`/`blocked`/`not_applicable`/
`conflicted`/`stale`), the resulting Evidence Coverage percentage, and a
`rating_eligibility` (`official`/`provisional`/`not_rateable`). **Never
mutated in place** — a re-run produces a new snapshot; comparing snapshots
over time is how coverage-improvement work gets measured (AJR-SPEC.md § 9
Phase 4).

## Publisher registry — see AJR-SPEC.md § 8

`publishers/*.json` entries let a verified, publisher-wide policy (only
`publication_ethics`, `corrections_retractions`, `authorship_policy`,
`coi_policy`, `ai_use_policy`, `data_availability` — never editorial
board, peer-review model, aims & scope, publication frequency, or a
journal-specific APC amount) fill an `unknown`/`blocked` gap for every
journal under that publisher, instead of being re-crawled per journal.

**This directory ships empty.** AJR-SPEC.md § 8/§ 13 itself leaves "who
verifies a publisher-wide policy's stated scope, and how is a dispute
resolved" as an open governance question — no entry here has been through
that verification yet. An entry is added only once a person has actually
checked a publisher's stated policy and confirmed its scope; until then,
every journal is resolved purely from its own crawled evidence
(`applyPublisherInheritance()`'s behavior with an empty registry is a
no-op, by design — see its own test file for that guarantee).

## Entry format

```json
{
  "publisher": "Publisher Name",
  "policy_type": "publication_ethics",
  "scope": "all_journals",
  "evidence_url": "https://...",
  "verified_by": "<name/role>",
  "verified_at": "2026-08-20"
}
```
