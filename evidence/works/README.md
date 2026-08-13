# Works (article-sample evidence)

Per-journal article-level data — the input `posi-engine`'s
`src/ajr-early-stage.mjs` Dimensions 3 (Metadata & Digital Infrastructure),
4 (Publishing Stability & Operational Performance), 5 (Scholarly Output
Quality Signals), and 6 (Scholarly Reach & Concentration) actually score
against. Produced by `posi-engine`'s Article-Sample ETL v1 pipeline
(`src/works-fetch.mjs` / `src/works-resolver.mjs`, orchestrated by
`scripts/run-works-etl.mjs`), not hand-edited.

**Nothing in `evidence/journals/` (the existing site-crawl Evidence ETL
output — Dimensions 1, 2, 7 only) overlaps with this directory.** The two
are complementary, independently-produced evidence sources feeding
different dimensions of the same AJR-E-1.1 rubric; a journal's full
Evidence Coverage picture requires both.

## Why this exists

`evidence-etl-v1-core30-2026` (this repo's `audits/evidence-etl/`) crawls a
journal's own WEBSITE for policy-disclosure text (aims & scope, editorial
board, ethics policies, ...). It never fetches article-level bibliographic
data — no title/abstract/reference-count/license/author-identifier
information existed anywhere in `posi-data` before this pipeline. Without
it, `ajr-early-stage.mjs`'s Dimension 5/6 scorers (`scoreOutputSignals()`,
`scoreReachConcentration()`) have no `articles` input to score at all, and
Dimension 3/4's infrastructure/cadence sub-items have no real signal
either — see `audits/works-etl/works-etl-v1-core30-2026/README.md` for the
full finding that motivated building this.

## Source: Crossref, not OpenAlex

`src/works-fetch.mjs` queries Crossref's `/journals/{issn}/works` REST API,
not OpenAlex — Crossref's `author` objects carry split `given`/`family`
names, which `ajr-early-stage.mjs`'s `resolveAuthorIdentity()` requires
(the AJR-E-1.1 bug fix: author identity resolves via ORCID -> normalized
given+family name, never affiliation; OpenAlex only exposes a combined
`display_name`, not a reliable given/family split). Crossref also exposes
`references-count`, `license`, `abstract`, and `deposited` timestamps
directly. AJR-SPEC.md's own First Regular Scholarly Publication Date
resolution priority already ranks Crossref above OpenAlex for the same
"better structured metadata" reason.

## Layout

```
evidence/works/<posi_id>.json   -- one article-sample evidence package per journal
```

Flat, matching `evidence/journals/`'s existing convention at this corpus
scale.

## Journal works package shape

```json
{
  "posi_id": "POSI-J-000001",
  "journal_code": "grhas",
  "title": "Global Review of Humanities, Arts, and Society",
  "issn_queried": "3052-539X",
  "crossref_status": 200,
  "total_results": 40,
  "works_fetched": 40,
  "article_sample": [ /* up to 30 normalized works, spread across issues -- see below */ ],
  "sample_adequacy": { "sufficient": true, "size": 30, "meets_target": true, "spans_multiple_periods": true, "note": "..." },
  "infrastructure_item_statuses": {
    "doi_resolution_reliability": "met",
    "crossref_metadata_completeness": "met",
    "abstract_reference_license_metadata": "met",
    "structured_author_affiliation_identifiers": "not_met",
    "oai_pmh_schema_org_machine_readable": "met",
    "digital_preservation_archiving": "not_met"
  },
  "doi_resolution_checks": [ /* up to 10 live doi.org resolution checks */ ],
  "oai_pmh_check": { "attempted": true, "ok": true, "http_status": 200, "error": null },
  "publishing_stability": {
    "cadence": { "expectedWindows": 8, "metWindows": 6 },
    "continuity": { "totalWindows": 6, "activeWindows": 5 },
    "deposit_timeliness": "not_met"
  },
  "frequency_disclosed": "unknown",
  "first_publication_date_used": "2025-04-03",
  "works_methodology_version": "WORKS-1.0",
  "snapshot_date": "2026-08-13"
}
```

Each `article_sample` entry is exactly the shape
`scoreOutputSignals()`/`scoreReachConcentration()` (`ajr-early-stage.mjs`)
take: `doi`, `title`, `hasAbstract`, `referenceCount`, `hasLicense`,
`hasArchive`, `documentType`, `publishedDate`, `depositDate`,
`issueOrPeriod`, `containerTitle`, `authors[]` (`affiliation`, `orcid`,
`given_name`, `family_name`).

### `frequency_disclosed` is always `"unknown"` in this dataset — a known, separate gap

Dimension 4's `frequency_disclosed` evidence item ("is publication
frequency disclosed on the journal's own site") is a website-crawl
question, not an article-data question — this pipeline deliberately does
not answer it, and `evidence-resolver.mjs`'s `EVIDENCE_CRITERIA` (the
existing site-crawl pipeline) doesn't check it yet either. Using
`corpus/core-collection.json`'s own `frequency` field (populated at
ingestion time by a person reading the site, not by a crawl-verified
disclosure check) as a stand-in would be exactly the kind of "claim more
than was actually computed" this project has already had to correct once
(see `audits/migrations/citation-preview-correction-2026/`) — so this item
stays `unknown` here rather than guessed. Trivially fixable later by adding
one more criterion to `evidence-resolver.mjs`'s `EVIDENCE_CRITERIA` list.

### Cadence is only computable for a genuinely periodic stated frequency

`publishing_stability.cadence` is `{ expectedWindows: 0, metWindows: 0 }`
(read by `ajr-early-stage.mjs`'s `computeCadenceScore()` as "not
computable," a `null` score, never a failing `0`) whenever a journal's
`frequency` is `Continuous`, `Irregular`, unrecognized, or its First
Regular Scholarly Publication Date is unresolved. Only `Monthly` /
`Bimonthly` / `Quarterly` / `Biannual` / `Annual` journals get a real
cadence-match computation — see `src/works-resolver.mjs`'s
`FREQUENCY_WINDOW_MONTHS`. `publishing_stability.continuity` uses a fixed
3-month window regardless of stated frequency (documented judgment call,
same disclosure style as `ajr-early-stage.mjs`'s own continuity/output
sub-scorers) and so is computable for any journal with a resolved launch
date.

### Sample size varies honestly by real journal output

`article_sample` is capped at 30 (`TARGET_ARTICLE_SAMPLE_SIZE`,
`ajr-early-stage.mjs`) but is smaller — sometimes below the framework's own
minimum of 10 — for journals that genuinely haven't published that many
articles yet. `sample_adequacy.sufficient: false` is a real, expected
finding for a young or low-output journal, not a resolver defect; the
AJR-E-1.1 spec's own rule is that Dimension 5 scores exactly `0` with an
"insufficient sample" note below the minimum, never a best-effort score on
too little data.

### OAI-PMH check only runs where a journal has one

`oai_pmh_check` is `null` for journals with no `oai_base_url` on their
corpus record (11 of 31 as of this run) — an untried check, not a
confirmed absence; `infrastructure_item_statuses.oai_pmh_schema_org_machine_readable`
resolves `unknown` for those, never `not_met`.

**Never mutated in place** — a re-run produces a new snapshot, same
discipline as `evidence/journals/`.

## What this does NOT do

- Does not compute or write `rating_eligibility`, a dimension score, or an
  AJR-E total — this is article-sample evidence only, the same
  separation-of-concerns `run-evidence-etl.mjs` already established for
  site evidence. Combining this with `evidence/journals/`'s site evidence
  into a real AJR-E-1.1 score is a later, separate step.
- Does not touch `corpus/core-collection.json`.
- Does not resolve `frequency_disclosed` (see above).
