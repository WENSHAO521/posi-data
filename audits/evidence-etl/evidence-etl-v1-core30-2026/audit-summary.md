# Evidence ETL v1 — Core Collection Audit (31 journals)

Real run of `posi-engine`'s Evidence ETL pipeline against Core Collection's
31 journals. **This is the fourth run.** Runs 1-3 were pre-merge review
iterations (a resolver bug, then a relevance-mapping refinement — see git
history of this file for that narrative). **This run is against the fully
production-hardened engine** (canonical AJR-E evidence ids, the missing
`other_applicable_terms` criterion, tightened false-positive patterns,
same-origin/anchor-text/robots-grouping/publisher-verification fixes, and
operational robustness for the 1000-journal scale-up) and surfaced a real,
live, external finding — see "What this run found" below.

## Final numbers (run 4, production-hardened engine)

```
Input journals:              31
Total page fetches attempted: 913
Total pages fetched OK:       196
Total 404s:                   515

Site evidence coverage distribution:
  100%      19
  90-99%     0
  80-89%     0
  60-79%     0
  <60%      12

Evidence item status counts (across 651 items = 31 journals x 21 criteria):
  met              313
  not_met          129
  blocked            0
  unknown          178
  conflicted         0
  stale              0
  not_applicable     31   (other_applicable_terms, every journal, by design -- see below)

Mean site evidence coverage: 72.13%
```

**651 = 31 × 21**, not 620 (31 × 20) — this run has the full 21-criterion
shape (the missing `other_applicable_terms` item from earlier runs is
now present, always `not_applicable`).

## What this run found: a real, live infrastructure problem, not a resolver regression

12 of the 31 journals dropped well below 100% coverage (5%–54%), and 178
items resolved `unknown` where earlier runs had 0. **This is not a bug in
this pass's fixes — it is exactly the kind of real signal the whole
resolver rewrite exists to surface.** Investigated directly:

- Every one of the 12 low-coverage journals is hosted on **`ojs.shiharr.com`**
  (SHIHARR PUBLISHING LIMITED's shared OJS platform) — 11 of the 12
  journals on that host are affected; the 12th (`POSI-J-000028`, also on
  `ojs.shiharr.com`) happened to land mostly-successful requests during
  this run's window and stayed at 100%.
- **Zero** journals on any other host (`journals.panorama-sg.com`,
  `atripress.org`, `www.onlinejandl.com`, `www.researchfrontpress.com`)
  were affected at all.
- A direct, manual, one-off fetch to `https://ojs.shiharr.com/index.php/xw`
  run immediately after this crawl **also failed** (`fetch failed` after
  ~10.7s) — confirming this is a real, currently-occurring problem with
  that specific shared host, not an artifact of this crawl's own request
  pattern or concurrency.
- Per-journal fetch breakdowns on the affected journals show a mix of
  `timeout` and `not_found`, consistent with an overloaded or
  intermittently-unresponsive server, not a hard outage (some requests to
  the same host succeeded within the same run).

**This is the old resolver's exact failure mode, now fixed and proven
working on a real case.** Before this pass's fixes, a site that's mostly
timing out would still have resolved most criteria to `not_met` — a
confident, wrong claim of absence — as long as its homepage happened to
load once. Now it correctly resolves to `unknown`, honestly reflecting
"we don't know, the crawl couldn't get through" rather than manufacturing
a clean-looking but false result.

**Recommendation: do not treat this run's low-coverage journals as final
evidence.** Re-run Evidence ETL against Core Collection (or at minimum the
`ojs.shiharr.com`-hosted subset, `POSI-J-000016` through `POSI-J-000027`)
once that host's responsiveness is confirmed normal again. This run's data
is committed as-is (a real, timestamped snapshot, not discarded or
re-rolled to get a cleaner-looking number) — the low coverage values
themselves are the correct, honest signal that a re-crawl is needed for
those specific journals, not evidence that anything is wrong with them.

## The met/not_met split (canonical AJR-E ids; compare against prior runs' now-renamed criteria)

```
Criterion                                   met  not_met  unknown  n/a
editorial_board_public                       25       1        5    0
peer_review_process_disclosed                25       1        5    0
editor_identity_affiliation_verifiable       25       2        4    0
aims_scope_explicit                          24       2        5    0
author_guidelines                            22       1        8    0
fee_disclosure                               21       3        7    0
access_model_disclosure                      21       3        7    0
copyright_licensing                          18       3       10    0
publication_ethics_policy                    16       5       10    0
publisher_ownership_contact                  16      11        4    0
plagiarism_similarity_policy                 15       4       12    0
conflict_of_interest_policy                  13       6       12    0
reviewer_editorial_guidelines                11       8       12    0
corrections_retractions_policy               11       8       12    0
authorship_contributorship_policy            10       9       12    0
human_animal_ethics_consent                  10      10       11    0
ai_use_policy                                10      12        9    0
complaints_appeals                            9      10       12    0
data_availability_sharing                     9      11       11    0
advertising_sponsorship_disclosure            2      19       10    0
other_applicable_terms                        0       0        0   31
```

Two things worth noting against the pre-hardening runs:

- **`publisher_ownership_contact`'s `not_met` count jumped from 1 to 11**
  after tightening its pattern (no longer accepting a bare "Published by
  X" byline as sufficient — see posi-engine's commit history). This is
  the tightening working exactly as intended: several journals that
  merely *name* their publisher without disclosing an actual contact
  channel are now correctly `not_met` instead of a false `met`.
- `unknown` now appears meaningfully across almost every criterion
  (previously always 0) — direct consequence of the `ojs.shiharr.com`
  finding above, spread across criteria roughly in proportion to how many
  of their relevant pages happened to be hosted there.

## What this run does NOT do

- Does not compute or write `rating_eligibility` or any AJR-E score —
  `site_evidence_coverage_percent` only.
- Does not apply publisher-level inheritance — `evidence/publishers/`
  ships empty.
- Does not touch `corpus/core-collection.json`.

## Recommended next step

1. Re-run against the 12 `ojs.shiharr.com`-affected journals once that
   host is confirmed responsive, to get a trustworthy baseline for that
   subset before this evidence is used for anything downstream.
2. Then scale to the 1000-journal Global Benchmark Collection, which
   includes major traditional publishers far more likely to trigger real
   403/429 bot-blocking than Core Collection's OJS sites — the real
   volume test of the `blocked` code path.
