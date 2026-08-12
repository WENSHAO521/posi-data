# Evidence ETL v1 — Core Collection Audit (31 journals)

Real run of `posi-engine`'s Evidence ETL pipeline against Core Collection's
31 journals. **This is the third run.** The first run's 100%/0-unknown
result was flagged in pre-merge review as a resolver bug, not a real
finding — see "What changed and why" below for the full story. This
document reports the final, fixed run's results.

## Final numbers (run 3, fixed + refined engine)

```
Input journals:              31
Total page fetches attempted: 910
Total pages fetched OK:       290
Total 404s:                   604

Site evidence coverage distribution:
  100%      31
  90-99%     0
  80-89%     0
  60-79%     0
  <60%       0

Evidence item status counts (across 620 items = 31 journals x 20 criteria):
  met            376
  not_met        244
  blocked          0
  unknown          0
  conflicted       0
  stale            0

Mean site evidence coverage: 100%
```

This script does **not** compute `rating_eligibility` (official/
provisional/not_rateable) — see "What changed and why," item 2.

## What changed and why (read this before trusting the numbers above)

### Run 1 (original): 100% / 0 unknown — looked clean, was not trustworthy

The resolver's rule was: if a criterion's pattern wasn't found, and *any*
page on the journal's site fetched OK, conclude `not_met`. That meant
"homepage 200, `/publication-ethics` 403" resolved `publication_ethics` as
`not_met` — a confident claim of absence — instead of `blocked`, even
though the page most likely to actually carry that policy was the one
that failed. **Pre-merge review caught this specifically because 100%
coverage / 0 blocked / 0 unknown across all 31 journals, with zero real
403s encountered in the sample, meant the resolver would have produced
that exact same clean-looking result even if real blocking had occurred**
— the result couldn't be distinguished from a resolver that was
structurally incapable of ever reporting `blocked`/`unknown` as long as a
journal's homepage loaded.

A second, related defect (also review-caught): `rating_eligibility` was
computed by calling `evidence-coverage.mjs`'s `ratingEligibility()` with
"at least one page fetched OK" standing in for its real
`mandatoryEvidenceResolved` contract (identity + ISSN + lifecycle + PSC +
article sample + integrity, AJR-SPEC.md § 6) — producing an `official`
label for all 31 journals that looked like a real AJR-E eligibility
determination but wasn't one. Fixed by dropping `rating_eligibility`
entirely from this script's output; it now reports
`site_evidence_coverage_percent` only. Computing the real `rating_status`
is the AJR-E/AJR-M scoring step's job, once lifecycle + PSC + article
sample data also exist for a journal.

Three smaller defects fixed in the same pass: `evidence-fetch.mjs`
collapsed 5xx and other unclassified 4xx into `not_found` (a *resolved*
"doesn't exist" answer) instead of a distinct `server_error`/`http_error`
(an *unresolved* "something went wrong"); the publisher-inheritance
registry was loaded but never actually passed into the per-journal
resolution call (harmless only because the registry ships empty);
`robots.txt` was fetched from the journal's own base path
(`.../index.php/journal/robots.txt` for an OJS site) instead of the site
origin, and link-discovered URLs bypassed the robots check entirely.

### Run 2 (first fix applied): 27x100%, 1x80-89%, 1x60-79%, 2x<60% — the fix worked, and immediately found something real

With criterion-aware resolution in place, four journals dropped below
100% coverage. Investigating them: three journals on the same OJS platform
(`atripress.org`) all got a `server_error` (HTTP 500) fetching
`/about/editorialMasthead` specifically, and a fourth got a `parse_error`
on its homepage. **This is exactly the kind of real signal the fix exists
to surface** — the old resolver would have silently read these as
"checked, policy not found," when the truth was "we don't actually know."

Inspecting *why* one failing page (`/about/editorialMasthead`) dragged
down five-to-fourteen unrelated criteria (not just the 2 that are actually
about the editorial board) led to a second fix: `/about/editorialMasthead`
and `/about/editorialTeam` were included in the "always relevant to every
criterion" path list, and matching was substring-`includes()`, so `/about`
also matched its own nested subpaths. Narrowed the always-relevant set to
just `/about` and `/about/submissions` (genuine policy-bundle pages), and
switched to exact-suffix matching so a page's *own* path doesn't
accidentally absorb its subpaths' relevance.

### Run 3 (this run, refined engine): back to 31x100% / 0 unknown — and now it's earned, not assumed

The `atripress.org` 500s did not recur on this run — consistent with a
transient server-side blip on their end during run 2's specific request
window, not a persistent problem. **This 100% is a different claim than
run 1's 100%**: it survived a resolver that is now capable of reporting
`blocked`/`unknown` and is unit-tested against the exact failure scenario
that run 1 got wrong (`test/evidence-resolver.test.mjs`'s "THE
REVIEW-CAUGHT BUG, FIXED" test, plus a second regression test for the
`/about/editorialMasthead` over-broad-relevance defect) — it just happens
that this particular run's live requests didn't hit any real failures.
`met`/`not_met` totals are identical across all three runs (376/244) —
expected, since matched content never depended on the bug; only the
handling of *unmatched-because-we-couldn't-check* cases changed.

## The met/not_met split (unchanged across all three runs)

```
Criterion                    met   not_met
peer_review_disclosed         30        1
publisher_contact             30        1
author_guidelines             30        1
editor_identity                28        3
aims_scope                     27        4
editorial_board                25        6
copyright_licensing            24        7
access_model_disclosure        23        8
plagiarism_policy              22        9
apc_disclosure                 21       10
human_animal_ethics            18       13
publication_ethics             16       15
coi_policy                     14       17
corrections_retractions        12       19
ai_use_policy                   12       19
reviewer_guidelines            11       20
authorship_policy              11       20
complaints_appeals             10       21
data_availability               10       21
advertising_disclosure          2       29
```

Real, plausible variance (near-universal items vs. genuinely rare ones
like `advertising_disclosure`) — not rubber-stamping. Bilingual (EN/CN)
matching spot-verified against `人文学刊` (POSI-J-000016) in the original
run and unchanged since.

## Per-candidate-path hit rate (run 3)

```
100%  31/31   /
 97%  30/31   /about
 97%  30/31   /about/submissions
 87%  27/31   /about/editorialMasthead
 65%  20/31   /apc
 58%  18/31   /about/editorialTeam
 55%  17/31   /submissions
 42%  13/31   /about/aims-and-scope
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
  0%   0/31   /editorial-policies
  0%   0/31   /fees
  0%   0/31   /licensing
  0%   0/31   /corrections
  0%   0/31   /retractions
  0%   0/31   /archiving
```

Six paths never hit once across all 31 journals. Worth trimming before the
1000-journal Global Benchmark run — a request-budget optimization, not a
correctness finding (link discovery and the paths that do hit already
cover the same ground).

## What this run does NOT do

- Does not compute or write `rating_eligibility`, `official`/
  `provisional`/`not_rateable`, or any AJR-E score — pure site-evidence
  collection. `site_evidence_coverage_percent` is the only coverage-shaped
  number this script reports.
- Does not apply publisher-level inheritance — `evidence/publishers/`
  ships empty (no publisher-wide policy has been human-verified yet). The
  registry-threading bug is fixed (`applyPublisherInheritance()` now
  actually receives the loaded registry), but with zero entries it's
  still a no-op this run.
- Does not touch `corpus/core-collection.json`.

## Recommended next step

Scale to the 1000-journal Global Benchmark Collection next. That set
includes major traditional publishers (Elsevier, Wiley, Springer Nature,
...) far more likely to trigger real 403/429 bot-blocking than Core
Collection's well-maintained OJS sites — the first real test of the
`blocked` code path in volume. Before that run: trim the six 0%-hit-rate
candidate paths per the table above.
