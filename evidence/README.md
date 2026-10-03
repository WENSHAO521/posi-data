# Evidence

Journal-level and publisher-level evidence records feeding AJR-E/AJR-M's
Evidence Coverage model (AJR-SPEC.md § 6, `posi-engine/src/evidence-
coverage.mjs`). Two independently-produced sources, covering different
AJR-E-1.1 dimensions, together not hand-edited:

- `journals/` — site-crawl evidence (Dimensions 1/2/7: Editorial
  Governance, Research Integrity, Transparency), from `posi-engine`'s
  Evidence ETL pipeline (`src/evidence-fetch.mjs` /
  `src/evidence-page-discovery.mjs` / `src/evidence-resolver.mjs` /
  `src/evidence-publisher-registry.mjs`, `scripts/run-evidence-etl.mjs`).
- `works/` — article-sample evidence (Dimensions 3/4/5/6: Infrastructure,
  Publishing Stability, Output Quality Signals, Reach & Concentration),
  from `posi-engine`'s Article-Sample ETL pipeline (`src/works-fetch.mjs` /
  `src/works-resolver.mjs`, `scripts/run-works-etl.mjs`) — see
  `works/README.md` for its own format and rationale.
- `output/` — yearly output (AJR-M Dimension 2: five-year continuity,
  output stability), works per publication year from the journal's OpenAlex
  source record, from `posi-engine`'s `scripts/run-output-history-etl.mjs`.
  Fetched for Mature journals only.

## Layout

```
evidence/
├── journals/<posi_id>.json      -- one site-crawl evidence package per journal
├── works/<posi_id>.json         -- one article-sample evidence package per journal
├── output/<posi_id>.json        -- one yearly-output record per Mature journal
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

**One file per journal, replaced by each refresh; earlier snapshots are its
git history.** posi-engine's monthly AJR rerate re-runs the ETLs and
replaces a journal's file only when the fresh run reached its source (at
least one page fetched `ok`, or, from EC-1.1, the journal's Crossref
deposits read for the policy signals of AJR-SPEC.md § 8; for `works/` a
Crossref 200; for `output/` the OpenAlex record read): a crawl the site blocked keeps the stored snapshot
instead of overwriting it with an empty one, and a run that reached no
source at all applies nothing (`scripts/apply-evidence-refresh.mjs`). The
change arrives as a pull request. `snapshot_date` tells snapshots apart;
comparing them over time is how coverage-improvement work gets measured
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

## Output history record shape

Each `output/<posi_id>.json` (illustrative values):

```json
{
  "posi_id": "POSI-J-000000",
  "title": "Example Journal",
  "openalex_source_id": "S0000000000",
  "counts_by_year": { "2021": 120, "2022": 131, "2023": 127, "2024": 118, "2025": 125 },
  "fetch_error": null,
  "snapshot_date": "2026-10-07"
}
```

`counts_by_year` is OpenAlex `works_count` per year (about the last ten
years); a year that is missing published nothing. It is `null`, with
`fetch_error`, when the source record could not be read — never an empty
history standing in for a failed request. AJR-M reads the last five complete
years before its rating date (AJR-M-1.0-SPEC.md § 11).

## Publisher registry — see AJR-SPEC.md § 8

`publishers/*.json` entries let a verified, publisher-wide policy fill an
`unknown`/`blocked` gap for every journal under that publisher, instead of
being re-crawled per journal. Only the inheritable items of AJR-SPEC.md § 8
qualify: twelve from EC-1.1 (AJR-E-1.2 / AJR-M-1.2), the six integrity
policies and six publisher-wide ones (similarity checking, human/animal
ethics, complaints, copyright, ownership, advertising). Aims and scope, editorial board, editor
identity, peer-review process, reviewer and author guidelines, publication
frequency, a journal's access model and fee disclosure
never do.

**Drafts.** One file per publisher (Elsevier, Wiley, Springer Nature,
Oxford University Press, MDPI, SAGE, Wolters Kluwer, ACS, Taylor & Francis,
Frontiers: about three quarters of the Global Benchmark journals AJR can
rate), one entry per inheritable item (12 per publisher). They are drafts: `evidence_url` is a
candidate page nobody has opened yet, or `null` where none is known, and
`verified_by`/`verified_at` are empty, so the ETL ignores every entry. To
make one count, open the page, confirm it states the policy and that it
covers all the publisher's journals, then fill `verified_by` and
`verified_at` (and drop `draft_note`). posi-engine's "Publisher registry
check" workflow reports which candidate pages answer.

An entry is only ever applied if it's well-formed: a real `http(s)`
`evidence_url`, a non-empty `verified_by`, and a parseable `verified_at` —
a malformed or incomplete entry is silently ignored rather than treated
as if verification happened (`isWellFormedEntry()` in
`posi-engine/src/evidence-publisher-registry.mjs`).

## Entry format

```json
{
  "publisher": "Publisher Name",
  "publisher_aliases": ["Publisher Name Ltd"],
  "policy_type": "publication_ethics_policy",
  "scope": "all_journals",
  "evidence_url": "https://...",
  "verified_by": "<name/role>",
  "verified_at": "2026-08-20"
}
```
