# PCS ETL v1 — Core Collection Audit (31 journals)

Real run of `posi-engine`'s new PCS (POSI Citation Score) data-acquisition
pipeline (`src/works-fetch.mjs`'s `PCS_SELECT_FIELDS`/`PCS_MAX_WORKS_PER_JOURNAL`,
`src/pcs-resolver.mjs`, `src/crossref-document-type.mjs`, orchestrated by
`scripts/run-pcs-etl.mjs`) against all 31 Core Collection journals,
2026-08-14. This is the fetch script PCS-1.0-SPEC.md's own header
explicitly flagged as "not yet built" — this run is its first real,
verified execution.

## Why this pipeline exists

PCS-1.0-SPEC.md defines a Crossref-based 4-year citation indicator
(`src/pcs.mjs`'s `calculatePcs()`), independently reported alongside PCI —
never blended with it, never gating on the annual PJR freeze. The
calculator existed and was unit-tested (`test/pcs.test.mjs`), but nothing
in either repo actually called the Crossref API and fed it real data. This
pipeline is that missing data-acquisition step.

## What is different from Article-Sample ETL v1 (`works-etl-v1-core30-2026`)

- **No sampling cap.** Every eligible work in the journal's 4-year
  publication window, not a ~30-article sample.
  `PCS_MAX_WORKS_PER_JOURNAL` (2,000,000) is a defensive backstop against a
  runaway fetch loop, not a real cap — more than 15x the highest real
  in-window count actually observed in this project's corpus (Scientific
  Reports, 126,635 works, found during scoping for the full-corpus run; see
  `pcs-etl-v1-global1024-2026`).
- **A specific 4-year publication-year window**, not "most recent N
  works." For `metric_year = 2026`: `from-pub-date:2022-01-01,until-pub-date:2025-12-31`
  — verified live against the real Crossref API before writing any code
  (cursor pagination + this exact filter syntax combine correctly; `rows`
  up to 1000 per page works cleanly).
- **Extracts `is-referenced-by-count`** (`PCS_SELECT_FIELDS`), which
  Article-Sample ETL v1's `WORKS_SELECT_FIELDS` never requested.
- **Tracks fetch coverage, not just a sample size** — `pcs_coverage` =
  successfully-fetched / Crossref's own reported `total-results` for the
  window filter, independent of document-type filtering.
- **Document-type normalization reuses `pci.mjs`'s `isCitable()`** via a
  new `crossref-document-type.mjs` crosswalk (Crossref `type` ->
  PJR-SPEC.md document_type), the same taxonomy PCI uses — see that
  module's header for a disclosed limitation (below).

## Final numbers (real Crossref data, 2026-08-14)

```
Input journals:                              31
Journals with a usable ISSN:                 31/31
Crossref 404 (no works registered at all):    1  (POSI-J-000030)
Journals with 0 works in the 2022-2025 window: 4 (see below — real, not a bug)
Journals with a complete fetch (coverage=1.0): 26/31
Journals with a partial fetch:                 0/31
Journals with PCS computed:                   26/31

Total works fetched (all journals, all pages): 738
Total eligible items (citable, in-window):     720
Total citation_count (sum is-referenced-by-count over eligible items): 244
Mean pcs_coverage across journals with any enumerated works:          1.0 (every page fetch succeeded on the first attempt)
```

## Cross-check against `works-etl-v1-core30-2026`: the same journal has the same real gap

`POSI-J-000030` (Digital Intelligence Frontiers, ISSN `3135-0011`) is a
genuine Crossref 404 in **both** this run and the earlier Article-Sample
ETL v1 run — the same journal, the same real "Crossref has never indexed
any work under this ISSN" finding, from two independently-written fetch
pipelines hitting the live API on different calendar dates. This is a real
cross-validation, not a coincidence: the journal's own corpus record
already carries `article_count: 0`.

## Four journals have zero PCS-eligible works — a real, verified finding, not a bug

`POSI-J-000010` (Climate Sustainability & Global Systems), `POSI-J-000011`
(Journal of Social Cognition and Communication), `POSI-J-000012`
(Silence), and `POSI-J-023332` (Contemporary Review of Political Thought)
all enumerate to 0 works in the 2022-2025 window. Checked directly against
live Crossref data (not assumed): each of these ISSNs has exactly 3
all-time registered works, and every one of them was published in **2026**
— e.g. `10.63802/csgs.v1.i1.258` (2026-03-04), `10.63802/silence.v1.i1.247`
(2026-03-07), `10.63802/jscc.v1.i1.291` (2026-03-24),
`10.63802/cropt.2026.319` (2026-07-28). PCS-1.0-SPEC.md § 5 explicitly
excludes the current year (`Y`) from the window because it is not yet
complete — these four journals only started publishing in 2026 itself, so
they correctly have no PCS-eligible history yet under a 2026 snapshot. This
is the pipeline working exactly as specified, not a resolver gap.

## Verified against raw Crossref data (spot-check discipline)

`POSI-J-000001` (GRHAS, ISSN `3052-539X`) was independently re-fetched and
hand-computed outside the pipeline before trusting the script's output:
38 Crossref records in the window (37 `journal-article` + 1
`journal-issue`), summed `is-referenced-by-count` = 13 across the 37
citable records, giving `13 / 37 = 0.3513513...` — this matches the
pipeline's own `pcs: 0.35135135135135137` exactly, including the
`journal-issue` structural record being correctly excluded from both
numerator and denominator by `crossref-document-type.mjs`'s
`mapCrossrefType()` (a `journal-issue` has no PJR-SPEC document_type
analog, so `isCitable()` returns false on it).

## Coverage: 100% on every journal that had anything to fetch

Every one of the 26 journals with in-window works achieved
`pcs_coverage: 1.0` — no page request failed even once across this run.
This is a small corpus (738 total works, largest single journal 157), so
this result doesn't yet exercise the pagination-failure/resume path in any
real way; see `pcs-etl-v1-global1024-2026` for the full-corpus run, which
does include real high-volume journals where transient failures are more
likely to actually occur.

## Known, disclosed limitation: Crossref's `type` field cannot separate editorials/letters/corrections from research articles

Verified live before writing `crossref-document-type.mjs` (not assumed):
Crossref's `/journals/{issn}/works` route has no `subtype` select field at
all, and real journals of very different sizes (JACS: 14,471 works,
Nature: 444,110 works, GRHAS: 41 works) all type essentially every
article-level record `journal-article`, with no further discrimination.
Unlike `openalex-document-type.mjs` (which at least separates OpenAlex's
`review`/`editorial`/`letter`/`erratum`/`retraction` types),
`crossref-document-type.mjs` maps `journal-article` to `research-article`
across the board — meaning `pcs_eligible_items` may include a small,
unknown number of editorials/letters/corrections that a Crossref-only
signal cannot separate out. Per this project's existing precedent
(`openalex-document-type.mjs`'s own header), this is disclosed rather than
papered over with a title-keyword guess. For this 31-journal corpus the
practical effect is likely small (these are early-stage journals
publishing mostly full research articles), but it should not be assumed
negligible for established, editorial-heavy journals in the full
Global Benchmark run.

## Files

- `audit-summary.json` — machine-readable summary (matches the numbers
  above; generated directly by `scripts/run-pcs-etl.mjs`).
- `per-journal-coverage.csv` — one row per journal: ISSN queried, fetch
  status, enumerated/fetched counts, PCS value, coverage.
- `journals/<posi_id>.json` — full per-journal diagnostic record (31
  files): issn queried, fetch status/error, enumerated vs fetched counts,
  pages fetched, the full PCS calculation breakdown, and
  `excluded_outside_window` (a defensive re-check count — see
  `pcs-resolver.mjs`'s `isInPcsWindow()`; it was 0 for every journal in
  this run, meaning Crossref's own `from-pub-date`/`until-pub-date` filter
  matched this pipeline's own window definition exactly for every fetched
  record here).
- `pcs/<shard>/<posi_id>.json` — the `schema/metric.schema.json`-declared
  PCS field subset only (`pcs`, `pcs_window_start_year`,
  `pcs_window_end_year`, `pcs_eligible_items`, `pcs_items_with_citation_data`,
  `pcs_coverage`, `pcs_source`, `pcs_source_retrieved_at`,
  `pcs_methodology_version`, plus `journal_id`/`metric_year`), sharded
  identically to `sharding.mjs`'s `metricPath()` convention — **not**
  written into the canonical `metrics/` tree. See "Where this data lives"
  below for why.

## Where this data lives (and why not `metrics/`)

`posi-data/CONTRIBUTING.md` is explicit: "Manual edits to `metrics/` or
`rankings/` — these are generated by posi-engine and are only ever updated
by its release workflow." This repo has no such release workflow yet (no
`.github/workflows` exist) — the existing precedent for this exact
situation is `run-pjr-seed-pipeline.mjs`, which computes real PCI/PCI-5/PNCI
data but deliberately writes it under
`audits/migrations/benchmark-corpus-seed/sample-output/`, using the
identical shard layout `sharding.mjs` defines, rather than the canonical
`metrics/<year>/` tree — "so a human reviewer... can inspect or promote it
deliberately, rather than this script silently establishing manual-PR-writes-
metrics as a precedent." This audit follows that same precedent for PCS.

**Additionally**, `schema/metric.schema.json`'s `required` array demands
`citable_items`, `methodology_version`, and `status` — all PCI-derived
fields this pipeline never computes (no PCI run exists for these 31
journals). The `pcs/<shard>/<posi_id>.json` files here are therefore a
genuine **subset** of a full metric snapshot, not a schema-conformant
record on their own — validated with `required` relaxed to just
`journal_id`/`metric_year` (every field that IS populated matches its
declared type/enum/range in `schema/metric.schema.json` exactly; 31/31
files pass that relaxed check). Fabricating placeholder values for the
missing PCI fields to force full schema validity would be exactly the kind
of invented number this project's discipline forbids — merging this real
PCS data into a genuine full metric snapshot is left for whenever a real
PCI computation exists for these journals (or for a future engine-driven
release workflow that can honestly assemble both halves).

## Reproducibility

```
node scripts/run-pcs-etl.mjs \
  --corpus /path/to/posi-data/corpus/core-collection.json \
  --out <output dir> \
  --metric-year 2026 --concurrency 4 --delay-ms 200 --rows 500
```

Companion `posi-engine` PR has the fetch/resolver/type-crosswalk source,
its own unit tests (`crossref-document-type.test.mjs`,
`pcs-resolver.test.mjs`, plus `works-fetch.test.mjs` additions for
`PCS_SELECT_FIELDS`/`PCS_MAX_WORKS_PER_JOURNAL`/`selectFields`), and the
full commit history.

## Relationship to the full-scope run

The user-requested scope for this work is 31 Core Collection + 993 curated
Global Benchmark journals (1024 total, `corpus/global-benchmark.json`
filtered to entries without `source_note` — the same "curated" convention
the website repo's `sync-corpus.mjs` uses). This audit directory covers
only the 31-journal validation slice, run first on purpose (build the
script, run it small, spot-check it against raw Crossref data, confirm the
schema/storage shape, THEN scale up) — see `pcs-etl-v1-global1024-2026/`
for the full-corpus run and its own real numbers, feasibility findings,
and any scope notes.
