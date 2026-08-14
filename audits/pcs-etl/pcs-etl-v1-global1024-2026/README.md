# PCS ETL v1 — Full-Scope Audit (1024 journals: 31 Core Collection + 993 curated Global Benchmark)

Real run of `posi-engine`'s PCS (POSI Citation Score) data-acquisition
pipeline against the full requested scope: all 31 Core Collection
journals plus the 993 curated Global Benchmark journals (`corpus/global-benchmark.json`
filtered to entries without `source_note` — the curated subset, same
convention the website repo's `sync-corpus.mjs` uses). 2026-08-14.

This run follows `pcs-etl-v1-core30-2026` (the 31-journal validation slice,
run and merged first on purpose — build small, spot-check against raw
Crossref data, confirm the schema/storage shape, then scale up).

## Final numbers (real Crossref data, 2026-08-14)

```
Input journals:                                1024
Journals with a usable ISSN:                   1023/1024
Journals with no ISSN on record:                  1  (EGUGA — corpus record itself has no issn_print/issn_online)
Crossref 404 (ISSN not registered at Crossref):  14
Journals with a complete fetch (coverage=1.0):  964
Journals with a partial fetch:                    0  (see "A real bug, found and fixed mid-run" below)
Journals with zero eligible items:               60  (14 404s + 1 no-ISSN + 45 genuine-zero-in-window, see breakdown below)
Journals with PCS computed:                     964

Total works fetched (all journals, all pages):    4,246,202
Total eligible items (citable, in-window):        4,238,617
Total citation_count (sum is-referenced-by-count over eligible items): 51,170,241
Mean pcs_coverage across journals with anything enumerated: 1.0 (exactly)
```

Unweighted mean PCS across the 964 journals with a computed value:
**9.96**. Highest real PCS values found: *Cell* (93.04, 1944 eligible
items), *Chemical Society Reviews* (86.35), *New England Journal of
Medicine* (69.12, 4191 eligible items), *Nature Medicine* (63.44),
*Science* (47.65, 8099 eligible items) — all real, top-tier journals,
exactly the shape of result a real citation indicator should produce.
Largest single journal by real 4-year output: *Scientific Reports*
(126,635 eligible items, PCS 9.91), followed by *Cureus* (80,203, PCS
1.76 — a real, honest low-impact-high-volume finding, not a data error),
*PLoS ONE* (68,368, PCS 7.18).

## A real bug, found and fixed mid-run

3 journals (Journal of Food Engineering, Cytokine, BMC Health Services
Research) initially stopped pagination early at 76.6%/90.2%/84.6%
coverage — each hit a page that returned Crossref status 200 with zero
items, while Crossref's own `total-results` said more records remained.
This was **not** treated as a silent success: `pcs_coverage` correctly
flagged the shortfall the moment it happened, which is exactly what
PCS-1.0-SPEC.md § 7/§ 9's coverage tracking exists to catch.

Investigated rather than shrugged off: re-issuing the identical cursor
request moments later returned the correct remaining page in full,
confirming this was a transient artifact of concurrent load
(`concurrency=8` against Crossref's cursor/scroll context) and not
genuine end-of-results. Fixed in `posi-engine` (companion PR): when a
page returns zero items but the journal's own fetched-so-far count is
still short of Crossref's reported total, `run-pcs-etl.mjs` now retries
the identical cursor up to 3 times (1.5s apart) before accepting real
exhaustion. `works-fetch.mjs`'s shared `fetchAllCrossrefWorks()` (used by
Article-Sample ETL v1) was deliberately left untouched — treating a
zero-item page as real exhaustion is correct there.

All 3 affected journals were re-fetched with `--force` after the fix and
now reach `pcs_coverage: 1.0` (1306/1306, 1109/1109, 6513/6513). A full
resume-mode pass across the entire 1024-journal corpus afterward (which
correctly skipped re-fetching the other 1021 already-complete journals —
`skipped_already_done: 1024` in `audit-summary.json` reflects this final
regeneration pass, not the original fetch run) confirms **0 journals with
partial coverage repository-wide** and `mean_pcs_coverage` of exactly
1.0. The numbers reported throughout this README are from that corrected,
final state.

## Verified against raw Crossref data at three different scales

Spot-checking discipline applied at small, medium, and large scale before
trusting the aggregate numbers:

- **Small** (`pcs-etl-v1-core30-2026`): GRHAS, 37 eligible items, 13
  citations, `pcs: 0.35135135135135137` — independently hand-computed
  from a separate raw fetch, matches exactly.
- **Medium**: Tetrahedron Letters (ISSN `0040-4039`), 1893 eligible items
  — independently re-fetched (4 pages, `rows=700`) and hand-summed
  outside the pipeline: 6015 total citations, `6015/1893 = 3.177496...`,
  matches the pipeline's stored `pcs: 3.177496038034865` and
  `pcs_citation_count: 6015` exactly.
- **Large-scale consistency**: Journal of the American Chemical Society
  (14,471 works) and Nature (444,110 works, all-time) were checked via
  Crossref's `type-name` facet before writing any fetch code — confirming
  the `journal-article`-dominant type distribution
  `crossref-document-type.mjs` is built against is real, not assumed.

## 60 zero-eligible-items journals — every one individually verified, not a single unexplained case

Breaking down all 60 (excluding none):

- **14 genuine Crossref 404s** — the ISSN in `corpus/global-benchmark.json`
  is not registered as a known journal container at Crossref at all
  (checked both the `/journals/{issn}/works` route AND the base
  `/journals/{issn}` metadata route directly — both 404 for all 14,
  confirming this is a real absence, not a route-specific quirk). Includes
  some well-known titles — e.g. *Cochrane Database of Systematic
  Reviews* (`1361-6137`), *PLoS neglected tropical diseases*
  (`1935-2727`), *American Journal of Roentgenology* (`0002-9580`) — where
  the corpus's `issn_online` field almost certainly does not match the
  ISSN Crossref actually has these titles registered under (no
  `issn_print` fallback exists on these records to try instead). **This
  is a real Global Benchmark corpus data-quality finding, out of scope
  for this pipeline to fix** — correcting corpus ISSN mappings is a
  separate, later task; this pipeline's job is to report the gap
  honestly, which it does via `fetch_status: 404`, never a fabricated 0.
- **1 no-ISSN journal**: EGUGA (`POSI-J-023373`) — the corpus record
  itself has `issn_print: null, issn_online: null` (also
  `metadata_quality_score: 0`, `publisher: "Unknown"`) — genuinely nothing
  to query Crossref with.
- **4 too-new journals** (Core Collection): `POSI-J-000010`,
  `POSI-J-000011`, `POSI-J-000012`, `POSI-J-023332` — each has exactly 3
  all-time Crossref works, every one published in 2026 itself, correctly
  excluded by PCS-1.0-SPEC.md § 5's Y-4..Y-1 window (current year not yet
  complete). Same finding already documented in `pcs-etl-v1-core30-2026`.
- **37 stale/retired-ISSN journals** — real Crossref-registered ISSNs
  with real historical output, but the most recent deposited work
  predates the 2022-2025 window, in some cases by decades. Checked
  individually (most-recent-work date, live): *Physical Review A*
  (`0556-2791`, 18,212 all-time works, most recent **1989** — this is the
  pre-1990 original PRA ISSN, superseded when the journal split; the
  corpus record apparently carries the retired ISSN, not the current one),
  *Physical Review C* (`0556-2813`, 36,672 works, most recent 2015),
  *Molecular and Cellular Biology* (`0270-7306`, 7840 works, most recent
  2008), *physica status solidi (a)* (`0031-8965`, 24,215 works, most
  recent 2006). This is a genuine, disclosed corpus data-quality pattern —
  a meaningful slice of the Global Benchmark's legacy-journal ISSN
  mappings point at Crossref registrations that stopped receiving
  deposits well before this pipeline's window, not at each journal's
  current, active ISSN. Not fixed here (fixing corpus ISSN data is
  out of scope for a citation-fetch pipeline) — flagged for whoever owns
  `corpus/global-benchmark.json`'s ISSN provenance.
- **4 true-zero-output journals**: ISSN is genuinely registered at
  Crossref (not a 404) but has **zero** works deposited there, ever —
  `0044-3336`, `0373-0174`, `0161-6439`, `0078-5334`. Plausible for a
  niche/regional title whose DOIs, if any, were never deposited with
  Crossref specifically.

**Zero unexplained cases.** Every one of the 60 zero-eligible-items
journals traces to one of these five verified, disclosed reasons — none
required guessing.

## Known, disclosed limitation carried over from `pcs-etl-v1-core30-2026`

`crossref-document-type.mjs` cannot separate editorials/letters/corrections
from research articles the way `openalex-document-type.mjs` can (Crossref's
`type` field has no `subtype` and essentially all journal content types
`journal-article`) — see that audit's own section for the live verification.
At this corpus's scale (4.2M eligible items across 964 journals, many of
them large, editorial-heavy legacy journals like *Nature* and *Science*),
this limitation almost certainly has a real, non-negligible effect on
`pcs_eligible_items`/`pcs` for at least some journals — e.g. a journal that
runs frequent short editorials/correspondence under `journal-article` will
have those counted as eligible, citable items. This pipeline does not
attempt to estimate or correct for that effect (no title-keyword guess),
consistent with this project's discipline; it is disclosed here as a real,
scale-relevant caveat rather than left implicit.

## Where this data lives

Same as `pcs-etl-v1-core30-2026`: `posi-data/CONTRIBUTING.md` restricts
manual `metrics/`/`rankings/` writes to posi-engine's release workflow
(which doesn't exist yet). This audit's `pcs/<shard>/<posi_id>.json` files
(1024 of them) are the `schema/metric.schema.json`-declared PCS field
subset only, validated against the schema's own per-field type/enum/range
definitions with `required` relaxed to `journal_id`/`metric_year`
(1024/1024 pass) — not a full metric snapshot, since the PCI-derived
required fields (`citable_items`, `methodology_version`, `status`) were
never computed by this pipeline and are not fabricated to force schema
validity.

## Runtime / feasibility (for anyone re-running this)

The full 1024-journal fetch (4.24M works, ~4,300 Crossref requests at
`rows=1000`) completed in well under two hours end-to-end, using
`concurrency=8`, `delay-ms=150`, comfortably inside Crossref's polite-pool
`x-rate-limit-limit: 10`-per-second header (observed live). This was
faster than initially estimated from a stratified pre-run sample (which
projected a multi-hour, possibly multi-session effort) — the real
bottleneck turned out to be per-request network latency (~1-3s), not
Crossref's own rate limiting, so raising `concurrency` further would very
likely go faster still without needing to relax politeness. No scope
reduction was needed; the full requested 1024-journal scope was completed
in a single session.

## Files

- `audit-summary.json` — machine-readable summary (matches the numbers
  above; this is the FINAL regeneration pass's summary, run in resume
  mode after the empty-page-retry fix — `skipped_already_done: 1024`
  confirms it re-validated all 1024 already-complete results without
  re-fetching any of them).
- `per-journal-coverage.csv` — one row per journal.
- `journals/<posi_id>.json` — full per-journal diagnostic record (1024
  files).
- `pcs/<shard>/<posi_id>.json` — the `schema/metric.schema.json`-declared
  PCS field subset (1024 files), sharded per `sharding.mjs`'s
  `metricPath()` convention.

## Reproducibility

```
node scripts/run-pcs-etl.mjs \
  --corpus /path/to/posi-data/corpus/core-collection.json \
  --corpus /path/to/posi-data/corpus/global-benchmark.json \
  --benchmark-curated-only \
  --out <output dir> \
  --metric-year 2026 --concurrency 8 --delay-ms 150 --rows 1000
```

Re-running is safe and cheap even on an unmodified corpus: every journal
already has a completion marker, so a re-run with the same `--out`
resumes/skips instantly rather than re-fetching (as demonstrated by the
post-fix regeneration pass above, which touched 0 network requests for
the 1021 journals not affected by the bug).
