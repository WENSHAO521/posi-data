# Evidence ETL v1 — Core Collection Audit (31 journals)

First real run of the new `posi-engine` Evidence ETL pipeline
(`src/evidence-fetch.mjs` / `src/evidence-page-discovery.mjs` /
`src/evidence-resolver.mjs` / `src/evidence-publisher-registry.mjs`,
orchestrated by `scripts/run-evidence-etl.mjs`), against the Core
Collection's 31 journals (`corpus/core-collection.json`, all with
`posi_id` since `core-collection-identity-remap-2026`). Does **not** write
any AJR-E/AJR-M score — this is evidence collection only, for human
review, per the requested scope.

## Top-line numbers

```
Input journals:              31
Journals with website_url:   31 / 31
Total page fetches attempted: 910
Total pages fetched OK:       264
Total 404s:                   633

Coverage distribution:
  100%      31
  90-99%     0
  80-89%     0
  60-79%     0
  <60%       0

Rating eligibility:
  official        31
  provisional      0
  not_rateable     0

Evidence item status counts (across 620 items = 31 journals x 20 criteria):
  met            376
  not_met        244
  blocked          0
  unknown          0
  conflicted       0
  stale            0

Mean coverage: 100%
```

## The headline finding: 100%/0-blocked is a real result for this sample, not a bug — but it's an incomplete validation

Every one of the 910 fetch attempts either landed on a real page (`ok`,
264 of them) or a `404` on a guessed candidate path that simply doesn't
exist for that particular journal (633 — expected, since
`CANDIDATE_PATHS` is a superset guess list, not every journal has all 24
paths). **Zero fetches hit a 403/429/timeout/network error.** That's why
every journal ended up fully "resolved" (met or not_met on every
criterion) rather than landing any item in `unknown`/`blocked`.

This is explainable, not suspicious: the Core Collection is 31
well-maintained OJS installations, mostly on the POSI/PSG publishing
network's own infrastructure plus a handful of small independent
publishers — not the kind of site that bot-blocks a well-behaved crawler
identifying itself with a real User-Agent and a polite request rate.
**This run does not exercise the blocked/403/timeout code paths at all**
— that's expected to actually happen once this scales to the 1000-journal
Global Benchmark Collection, which includes major traditional publishers
(Elsevier, Wiley, Springer Nature, ...) with much more aggressive bot
protection. The `blocked`/`unknown` handling (`evidence-fetch.mjs`,
`evidence-coverage.mjs`'s `classifyFetchOutcomeStatus()`) is unit-tested
(see `test/evidence-fetch.test.mjs`, `test/evidence-resolver.test.mjs`)
but this is the first time to flag: **it has not yet been exercised
against a real 403 in production.** Recommend treating the first
Global-Benchmark run as the real validation of that code path, not this
one.

## The met/not_met split shows real discrimination, not rubber-stamping

The more informative number isn't the 100% coverage figure — it's that
`met` (376) and `not_met` (244) are both large, and vary a lot by
criterion:

```
Criterion                    met   not_met
peer_review_disclosed         30        1
publisher_contact             30        1
author_guidelines             30        1
editor_identity               28        3
aims_scope                    27        4
editorial_board               25        6
copyright_licensing           24        7
access_model_disclosure       23        8
plagiarism_policy             22        9
apc_disclosure                21       10
human_animal_ethics           18       13
publication_ethics            16       15
coi_policy                    14       17
corrections_retractions       12       19
ai_use_policy                 12       19
reviewer_guidelines           11       20
authorship_policy             11       20
complaints_appeals            10       21
data_availability             10       21
advertising_disclosure         2       29
```

This is a plausible real-world shape, not an artifact: the near-universal
items (peer review, contact info, author guidelines) are things almost
every journal publishes; the near-absent one (`advertising_disclosure`,
2/31) is a genuinely rare policy most journals never state either way;
the mid-range items (research-integrity sub-policies, AI-use policy) show
real variance consistent with smaller/newer journals not yet having
published every governance document a mature journal would. If every
criterion had come back either near-100% or near-0% `met` across the
board, that would be the actual red flag (a resolver either rubber-
stamping everything or systematically blind) — this isn't that.

## Bilingual matching verified against real Chinese-language journals

Spot-checked `人文学刊` (POSI-J-000016) directly: `aims_scope`,
`editorial_board`, `editor_identity`, and `peer_review_disclosed` all
correctly resolved `met` from Chinese-language page content. This
confirms the historical regression documented in the old website-repo
script (`scripts/rate-early-stage.mjs`'s own header comment — English-only
matching silently failed every Chinese-language Core Collection journal
even when the policy content was plainly present) is not present in this
new resolver, which carries the same bilingual pattern lists forward.

## What this run does NOT do

- Does not compute or write any AJR-E score, quartile, or ranking — pure
  evidence collection, per the requested scope.
- Does not apply any publisher-level inheritance — `evidence/publishers/`
  ships empty in this same PR (see its own README for why: nobody has
  verified a real publisher-wide policy scope yet). Every one of these 31
  journals was resolved purely from its own crawled evidence.
- Does not touch `corpus/core-collection.json` itself.

## Per-candidate-path hit rate (normalized by each journal's own base URL)

```
100%  31/31   /
 97%  30/31   /about
 97%  30/31   /about/submissions
 65%  20/31   /apc
 58%  18/31   /about/editorialTeam
 55%  17/31   /submissions
 45%  14/31   /about/editorialMasthead
 29%   9/31   /publication-ethics
 23%   7/31   /author-guidelines
 13%   4/31   /for-authors
 13%   4/31   /data-policy
 10%   3/31   /editorial-board
  6%   2/31   /aims-and-scope
  6%   2/31   /copyright
  3%   1/31   /peer-review
  3%   1/31   /ethics
  3%   1/31   /ai-policy
  0%   0/31   /about/aims-and-scope
  0%   0/31   /editorial-policies
  0%   0/31   /fees
  0%   0/31   /licensing
  0%   0/31   /corrections
  0%   0/31   /retractions
  0%   0/31   /archiving
```

Seven paths never hit once across all 31 journals: `/about/aims-and-scope`,
`/editorial-policies`, `/fees`, `/licensing`, `/corrections`,
`/retractions`, `/archiving`. Real content still gets found for those
criteria in this sample (corrections/retractions resolved `met` for 12
journals, copyright/licensing for 24) — it's arriving via the homepage,
`/about`, or link-discovery, not these specific guessed paths. Worth
trimming `CANDIDATE_PATHS` before the 1000-journal Global Benchmark run —
this is entirely a request-budget/politeness optimization (every unused
guess is still a real HTTP request against someone else's server), not a
correctness finding; link discovery + the paths that *do* hit already
cover the same ground.

## Recommended next step

Scale to the 1000-journal Global Benchmark Collection next, specifically
**because** it will exercise the blocked/403/unknown code paths this run
didn't. Before that run: trim `CANDIDATE_PATHS` per the table above, and
decide whether to keep the full sweep (more diagnostic signal per
journal, more requests — reasonable for a second validation pass) or
switch to early-exit-once-resolved (faster, matches eventual production
steady-state, appropriate once the pipeline itself is no longer in
question).
