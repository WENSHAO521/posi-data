# PCS ETL v1 — Full-Scope Audit (4320 journals: 31 Core Collection + full 4289-journal Global Benchmark)

Real run of `posi-engine`'s PCS (POSI Citation Score) data-acquisition
pipeline. Originally run 2026-08-14 against a first requested scope (31
Core Collection + 993 curated Global Benchmark = 1024 journals — see
"Phase 1" below), then **extended the same day** to the full Global
Benchmark (all 4289 entries — the 993 curated seed plus the 3296-journal
Elsevier/Frontiers publisher-catalog expansion, `corpus/global-benchmark.json`
in full, no `--benchmark-curated-only` filter) after a user-reported gap:
prominent publisher-catalog journals (*Cancer Cell*, *Progress in Energy
and Combustion Science*) showed no PCS on the live `/citation-reports`
page, correctly but confusingly, since they were simply out of Phase 1's
scope. This README documents both phases; **the numbers in this section
are the current, final, cumulative state** (Phase 1 + Phase 2 combined).

This run follows `pcs-etl-v1-core30-2026` (the 31-journal validation slice,
run and merged first on purpose — build small, spot-check against raw
Crossref data, confirm the schema/storage shape, then scale up).

## Final numbers (real Crossref data, cumulative through the 2026-08-14 expansion)

```
Input journals:                                 4320  (31 Core Collection + 4289 Global Benchmark, deduped by posi_id -- zero overlap found)
Journals with a usable ISSN:                   4319/4320
Journals with no ISSN on record:                   1  (EGUGA -- corpus record itself has no issn_print/issn_online)
Crossref 404 (ISSN not registered at Crossref):   55
Journals with a complete fetch (coverage=1.0):  4089
Journals with a partial fetch:                     0
Journals with zero eligible items:               231  (55 404s + 1 no-ISSN + 175 genuine-zero-in-window, see breakdown below)
Journals with PCS computed:                     4089

Total works fetched (all journals, all pages):    6,769,259
Total eligible items (citable, in-window):        6,761,398
Total citation_count (sum is-referenced-by-count over eligible items): 75,430,802
Mean pcs_coverage across journals with anything enumerated: 1.0 (exactly)
```

Unweighted mean PCS across the 4089 journals with a computed value:
**8.98**. Highest real PCS values found: *Progress in Materials Science*
(99.90, 458 eligible items), *Progress in Energy and Combustion Science*
(98.62, 141 eligible items), *eScience* (95.79, 254 eligible items),
*Cell* (93.04, 1944 eligible items), *Chemical Society Reviews* (86.35,
1519 eligible items), *Cancer Cell* (75.90, 775 eligible items), *New
England Journal of Medicine* (69.12, 4191 eligible items) — all real,
top-tier or high-impact-review journals, exactly the shape of result a
real citation indicator should produce (review journals with few, highly
cited articles per year naturally sit at the top of a per-article mean).
Largest single journal by real 4-year output: *Scientific Reports*
(126,635 eligible items, PCS 9.91), followed by *Cureus* (80,203, PCS
1.76 — a real, honest low-impact-high-volume finding, not a data error),
*PLoS ONE* (68,368, PCS 7.18), *International Journal of Molecular
Sciences* (59,781, PCS 14.30), *Sustainability* (56,676, PCS 12.07).

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
- **Phase 2 targeted spot-check** — the two journals that triggered
  Phase 2 in the first place: *Cancer Cell* (ISSN `1535-6108`) and
  *Progress in Energy and Combustion Science* (ISSN `0360-1285`), each
  independently re-fetched outside the pipeline (full cursor pagination,
  same `from-pub-date`/`until-pub-date` filter, hand-summed
  `is-referenced-by-count`): Cancer Cell — 775 eligible items, 58,822
  total citations, `58822/775 = 75.89935483870968`, matches the
  pipeline's stored `pcs: 75.89935483870968` exactly; Progress in Energy
  and Combustion Science — 141 eligible items, 13,906 total citations,
  `13906/141 = 98.62411347517731`, matches the pipeline's stored
  `pcs: 98.62411347517731` exactly. Both real, both coverage 1.0.

## Phase 2 — extending to the full 4289-journal Global Benchmark (2026-08-14, same day)

**Trigger.** A user looking at the live `/citation-reports` page saw "—"
(no PCS) for prominent journals like *Cancer Cell* and *Progress in
Energy and Combustion Science*. These were correctly outside Phase 1's
scope — Phase 1 only covered the curated 993-journal Global Benchmark
seed, not the 3296-journal Elsevier/Frontiers publisher-catalog
expansion those two titles belong to — but the display gave no indication
*why*, reading as a data gap rather than an intentional scope boundary.
Rather than just fix the display copy, the decision was to close the
actual scope gap: run PCS for the remaining ~3296 journals for real.

**How it was run.** Same script, same output directory (`--out` pointed
at this exact audit directory), corpus args changed from
`--corpus core-collection.json --corpus global-benchmark.json
--benchmark-curated-only` to the same two `--corpus` flags **without**
`--benchmark-curated-only` — i.e. the full, unfiltered `global-benchmark.json`
(4289 entries: 993 curated + 3296 publisher-catalog) plus
`core-collection.json` (31), deduplicated by `posi_id` inside
`run-pcs-etl.mjs`'s own `main()` (confirmed zero `posi_id` overlap between
the two corpus files before running — Core Collection and Global
Benchmark are disjoint sets). Loaded 4320 unique journals total; the
existing per-journal completion markers in `journals/<posi_id>.json`
(written by Phase 1) made the script skip all 1024 already-done journals
(`skipped_already_done: 1024` in the resulting `audit-summary.json`) and
fetch only the genuinely new ~3296.

**Concurrency — investigated live, not assumed.** Phase 1's README
speculated that concurrency could safely go higher than 8 since the
bottleneck looked like network latency, not Crossref's rate limit. Before
raising it for Phase 2, this was checked directly against the live API:
firing 8 fully-synchronized concurrent requests (`Promise.all`, zero
stagger — deliberately the worst case, worse than the pipeline's own
batching which is naturally desynchronized by each journal's own
multi-page pagination) already drew an occasional 429; 10 concurrent drew
429s on ~20% of requests; 14 concurrent drew 429s on ~30-35% of requests,
consistently reproduced across repeated trials. Crossref's polite-pool
`x-rate-limit-limit: 10` header (confirmed live, `x-rate-limit-interval: 1s`)
is a real, firm wall at this scale, not a theoretical ceiling — the
existing retry/backoff (`fetchCrossrefWorksPage`'s exponential backoff on
429) absorbs it fine at `concurrency=8`, but pushing higher would spend
more of that retry budget rather than actually increasing sustained
throughput. **Decision: kept `concurrency=8, delay-ms=150`, unchanged from
Phase 1** — a measured conclusion, not a default left alone. It turned
out not to matter for wall-clock time anyway: see below.

**Runtime.** The new ~3296 journals (all publisher-catalog titles —
mostly small/mid-size Elsevier and Frontiers journals, not the huge
legacy-generalist titles like *Nature*/*Science* that were already inside
the curated 993 from Phase 1) fetched 2,523,057 additional works in
**about 42 minutes** (18:44–19:26), far under the multi-hour budget this
phase was planned around. The publisher-catalog set turned out to skew
toward specialist/niche journals with four-year windows in the hundreds
to low-thousands of works each, not the six-figure volumes Phase 1's
largest titles had — no journal in this batch came close to *Scientific
Reports*' 126,635-item Phase 1 record.

## 231 zero-eligible-items journals (cumulative, Phase 1 + Phase 2) — every one individually verified, not a single unexplained case

Breaking down all 231 (excluding none; the 60 from Phase 1 are included
in these totals, re-verified where their category changed):

- **55 genuine Crossref 404s** (14 from Phase 1 + 41 new) — the ISSN in
  `corpus/global-benchmark.json` is not registered as a known journal
  container at Crossref at all (checked both the `/journals/{issn}/works`
  route AND the base `/journals/{issn}` metadata route directly — both
  404, confirming this is a real absence, not a route-specific quirk).
  Includes well-known titles whose corpus `issn_online` almost certainly
  doesn't match the ISSN Crossref has them registered under (no
  `issn_print` fallback on these records) — e.g. *Cochrane Database of
  Systematic Reviews* (`1361-6137`), *PLoS neglected tropical diseases*
  (`1935-2727`), *American Journal of Roentgenology* (`0002-9580`) from
  Phase 1, plus new Phase 2 examples like *Academy of Management Inside
  Organizations* (`3117-9878`) and *Acta Adamantum* (`2773-224X`). **A
  real Global Benchmark corpus data-quality finding, out of scope for
  this pipeline to fix** — reported honestly via `fetch_status: 404`,
  never a fabricated 0.
- **1 no-ISSN journal**: EGUGA (`POSI-J-023373`) — the corpus record
  itself has `issn_print: null, issn_online: null` (also
  `metadata_quality_score: 0`, `publisher: "Unknown"`) — genuinely nothing
  to query Crossref with.
- **106 too-new journals** (4 from Phase 1's Core Collection + 102 new
  Phase 2 publisher-catalog titles) — Crossref registers the ISSN and has
  real works under it, but every single one falls *after* the 2022-2025
  window (oldest work found is 2026 or later), correctly excluded by
  PCS-1.0-SPEC.md § 5's Y-4..Y-1 window. Verified individually for all
  171 non-404, non-no-ISSN, status-200-zero-eligible journals by fetching
  each ISSN's single oldest and single most-recent published work live
  (not inferred) — e.g. *The Lancet Regional Health – Africa*
  (`3050-5011`, 125 all-time works, oldest **2026-08**, a brand-new title
  whose 2026 output simply hasn't crossed into a completed 4-year window
  yet).
- **64 stale/retired-ISSN journals** (37 from Phase 1 + 27 new) — real
  Crossref-registered ISSNs with real historical output, but the most
  recent deposited work predates 2022-01-01, in some cases by decades.
  Verified live per-journal (most-recent-work date fetched directly, not
  assumed): Phase 1 examples include *Physical Review A* (`0556-2791`,
  18,212 all-time works, most recent **1989** — the pre-1990 original PRA
  ISSN, superseded when the journal split; the corpus record apparently
  carries the retired ISSN), *Physical Review C* (`0556-2813`, most recent
  2015), *Molecular and Cellular Biology* (`0270-7306`, most recent 2008);
  Phase 2 adds more of the same pattern, e.g. *PS: Political Science &
  Politics* (`0030-8269`, 2,995 all-time works, most recent work in the
  live Crossref record predates the window). A genuine, disclosed corpus
  data-quality pattern — a meaningful slice of the Global Benchmark's
  legacy-journal ISSN mappings point at Crossref registrations that
  stopped receiving deposits before this pipeline's window, not at each
  journal's current, active ISSN. Not fixed here (correcting corpus ISSN
  data is out of scope for a citation-fetch pipeline) — flagged for
  whoever owns `corpus/global-benchmark.json`'s ISSN provenance.
- **4 true-zero-output journals** (all from Phase 1, none new in Phase 2):
  ISSN is genuinely registered at Crossref (not a 404) but has **zero**
  works deposited there, ever — `0044-3336`, `0373-0174`, `0161-6439`,
  `0078-5334`. Plausible for a niche/regional title whose DOIs, if any,
  were never deposited with Crossref specifically.
- **1 irregular/gap-publication journal** (new in Phase 2, a distinct
  category not seen in Phase 1): *European Journal of Cancer Supplements*
  (`1359-6349`) — a real, active, Crossref-registered ISSN with 15,186
  all-time works spanning 2003 to **2026-03** (i.e. neither stale nor
  too-new by the simple date-boundary test), but a conference/supplement-
  tied publication schedule that genuinely deposited nothing between its
  last 2021-11 batch and its next 2026-03 batch — a real four-year gap
  that happens to land exactly on this pipeline's window. Verified live:
  fetching the ISSN's works sorted by published date shows the cluster
  boundary directly (last 2021 items, then a jump straight to 2026 items,
  nothing between). A genuine, disclosed edge case, not a bug.

**Zero unexplained cases.** Every one of the 231 zero-eligible-items
journals traces to one of these six verified, disclosed reasons — none
required guessing. (231 = 55 + 1 + 106 + 64 + 4 + 1.)

## Known, disclosed limitation carried over from `pcs-etl-v1-core30-2026`

`crossref-document-type.mjs` cannot separate editorials/letters/corrections
from research articles the way `openalex-document-type.mjs` can (Crossref's
`type` field has no `subtype` and essentially all journal content types
`journal-article`) — see that audit's own section for the live verification.
At this corpus's scale (6.76M eligible items across 4089 journals, many of
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
(4320 of them) are the `schema/metric.schema.json`-declared PCS field
subset only, validated against the schema's own per-field type/enum/range
definitions with `required` relaxed to `journal_id`/`metric_year`
(4320/4320 pass) — not a full metric snapshot, since the PCI-derived
required fields (`citable_items`, `methodology_version`, `status`) were
never computed by this pipeline and are not fabricated to force schema
validity.

## Runtime / feasibility (for anyone re-running this)

**Phase 1** (1024 journals, 4.24M works, ~4,300 Crossref requests at
`rows=1000`) completed in well under two hours end-to-end, using
`concurrency=8`, `delay-ms=150`, comfortably inside Crossref's polite-pool
`x-rate-limit-limit: 10`-per-second header (observed live).

**Phase 2** (the remaining ~3296 journals, 2.52M additional works)
completed in about **42 minutes**, same `concurrency=8, delay-ms=150` —
deliberately not raised despite Phase 1's README speculating it could be,
after a live check (see "Phase 2" section above) showed Crossref's 10
req/s polite-pool limit is a real, firm wall that even an 8-request
synchronized burst occasionally touches; raising concurrency further
would trade retry-budget consumption for throughput, not a clean win.
Phase 2 was fast primarily because the publisher-catalog set is
dominated by small/mid-size specialist journals, not because of any
concurrency change — no scope reduction was needed in either phase; the
full requested scope was completed in both cases within a single session.

## Files

- `audit-summary.json` — machine-readable summary (matches the "Final
  numbers" above; this is the cumulative Phase 1 + Phase 2 summary, run
  in resume mode — `skipped_already_done: 1024` in the underlying
  `summary.json` this was copied from confirms Phase 2 re-validated all
  1024 Phase-1-complete journals without re-fetching any of them, and
  fetched only the genuinely new ~3296).
- `per-journal-coverage.csv` — one row per journal (4320 rows).
- `journals/<posi_id>.json` — full per-journal diagnostic record (4320
  files).
- `pcs/<shard>/<posi_id>.json` — the `schema/metric.schema.json`-declared
  PCS field subset (4320 files), sharded per `sharding.mjs`'s
  `metricPath()` convention.

## Reproducibility

Phase 1 (Core Collection + curated Global Benchmark only):

```
node scripts/run-pcs-etl.mjs \
  --corpus /path/to/posi-data/corpus/core-collection.json \
  --corpus /path/to/posi-data/corpus/global-benchmark.json \
  --benchmark-curated-only \
  --out <output dir> \
  --metric-year 2026 --concurrency 8 --delay-ms 150 --rows 1000
```

Phase 2 (extends to the full Global Benchmark, reusing the same `--out`
so Phase 1's completion markers are skipped rather than re-fetched — just
drop `--benchmark-curated-only`):

```
node scripts/run-pcs-etl.mjs \
  --corpus /path/to/posi-data/corpus/core-collection.json \
  --corpus /path/to/posi-data/corpus/global-benchmark.json \
  --out <same output dir as Phase 1> \
  --metric-year 2026 --concurrency 8 --delay-ms 150 --rows 1000
```

Re-running either is safe and cheap even on an unmodified corpus: every
journal already has a completion marker, so a re-run with the same
`--out` resumes/skips instantly rather than re-fetching (as demonstrated
by Phase 2 itself, which touched 0 network requests for the 1024
Phase-1-complete journals).
