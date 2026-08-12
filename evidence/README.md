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
fetched and their `fetch_status` (see `evidence-fetch.mjs`'s 10-value
taxonomy), a resolved evidence item per criterion — `id` matching AJR-E's
own canonical evidence item ids verbatim (`src/ajr-early-stage.mjs` /
`src/shared-dimensions.mjs`, enforced by a contract test) — using
`evidence-coverage.mjs`'s 7-state model (`met`/`not_met`/`unknown`/
`blocked`/`not_applicable`/`conflicted`/`stale`), and the resulting
`site_evidence_coverage_percent`. **Does not include `rating_eligibility`**
— that requires the full AJR-E mandatory-evidence bar (identity, ISSN,
lifecycle, PSC, article sample, integrity — AJR-SPEC.md § 6), none of
which this Evidence-only pipeline computes; that determination happens at
the AJR-E/AJR-M scoring step, once those other inputs also exist for a
journal.

**Never mutated in place** — a re-run produces a new snapshot; comparing
snapshots over time is how coverage-improvement work gets measured
(AJR-SPEC.md § 9 Phase 4).

### `evidence_snapshot_status` — provenance, not a scoring field

- `complete` — every relevant page for every criterion either resolved
  (met/not_met) or is a criterion the crawl genuinely couldn't reach for
  ordinary reasons (a 404 on a guessed path, etc.) — no sign of a crawl
  disrupted by the source itself being flaky.
- `partial_source_unavailable` (with `recrawl_required: true`,
  `recrawl_reason`, `recrawl_host`) — this snapshot's low coverage is
  attributable to the source host having timed out / errored during the
  crawl window, not to the journal genuinely lacking policies. Never
  treated as a scoring input — it exists so a downstream pipeline (or a
  person) can tell "real gap" apart from "needs a re-crawl" without
  re-parsing prose out of an audit report. See
  `audits/evidence-etl/evidence-etl-v1-core30-2026/README.md` for a real
  example (12 journals flagged this way on 2026-08-12, all sharing one
  intermittently-unresponsive host).

## Publisher registry — see AJR-SPEC.md § 8

`publishers/*.json` entries let a verified, publisher-wide policy (only
`publication_ethics_policy`, `corrections_retractions_policy`,
`authorship_contributorship_policy`, `conflict_of_interest_policy`,
`ai_use_policy`, `data_availability_sharing` — never editorial board,
peer-review model, aims & scope, publication frequency, or a
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

An entry is only ever applied if it's well-formed: a real `http(s)`
`evidence_url`, a non-empty `verified_by`, and a parseable `verified_at` —
a malformed or incomplete entry is silently ignored rather than treated
as if verification happened (`isWellFormedEntry()` in
`posi-engine/src/evidence-publisher-registry.mjs`).

## Entry format

```json
{
  "publisher": "Publisher Name",
  "policy_type": "publication_ethics_policy",
  "scope": "all_journals",
  "evidence_url": "https://...",
  "verified_by": "<name/role>",
  "verified_at": "2026-08-20"
}
```
