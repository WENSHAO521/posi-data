# Changelog

Every change to a formula, threshold, citable-items table, confidence
model, or status enum in this repository's spec `.md` files is recorded
here, per [PJR-SPEC.md](./PJR-SPEC.md) § 11's methodology-versioning rule:
"Any change to a formula, threshold, or citable-items table in this
document requires a version bump and a CHANGELOG entry — a metric
snapshot's methodology version is permanent, so a reader can always tell
whether two PCI values across years were computed the same way." This file
existing at all is itself new — no top-level CHANGELOG previously existed
despite PJR-SPEC.md referencing one since v1.0.

## POSI Journal Evaluation & Ranking Framework 1.0

Implements the platform owner's approved methodology overhaul. See the
individual spec documents below for full detail; this entry indexes what
changed and why, across every version bump this rollout touched.

### Added

- **AJR-M 1.0** ([AJR-M-1.0-SPEC.md](./AJR-M-1.0-SPEC.md)) — the mature-
  journal rating model did not exist before this release. Mature journals
  (60+ months) were previously scored with the AJR-E rubric as an interim
  measure; this closes that gap. Resolves AJR-SPEC.md § 13's open question
  about AJR-M's non-citation sub-scoring formulas.
- **LIFECYCLE-1.1** exact date-boundary arithmetic
  (`launch_date + N months` vs. `rating_date`, not calendar-month
  subtraction) — fixes a real boundary bug where a journal launched near a
  month-end (e.g. 2025-08-31) could be misjudged as having crossed the
  12-month Observation→Early-Stage boundary a full month early
  (2026-08-01, when the correct boundary is 2026-08-31).
- **Evidence Coverage (EC-1.0)** — a seven-state per-evidence-item status
  model (`Met` / `Not Met` / `Unknown` / `Blocked` / `Not Applicable` /
  `Conflicted` / `Stale`, never a binary found/not-found), the
  `DimensionScore = DimensionWeight × (MetEvidenceWeight /
  ResolvedApplicableEvidenceWeight)` normalization formula, and the ≥80%
  Official / 60–79.99% Provisional / <60% Not Rateable eligibility gate
  (mandatory evidence still blocks Official rating regardless of EC%).
- **First Regular Scholarly Publication Date resolution (FPD-1.0)** —
  source-priority resolution (verified publisher/archive evidence →
  Crossref → OpenAlex → other archive → unknown), excluding editorial/
  call-for-papers/front-matter/correction/retraction-notice/announcement
  candidates, with a persisted resolution record so the decision is
  computed once, not re-guessed on every pipeline run.
- **Peer-cohort construction (COHORT-1.0)** — shared PSC L3≥20 → L2≥20 →
  L1≥30 → unavailable fallback chain, used identically by E-Q and M-Q.
- **E-Q / M-Q / Citation Q labeling** — `quartileLabel()` enforces the
  framework's "never a bare Q1 — always E-Q1/M-Q1/Citation Q1" display
  rule. Citation Q's existing ranking rule (PJR-SPEC.md § 8,
  `MIN_CATEGORY_SIZE = 20`, no Level-1 fallback) is kept unchanged — see
  the **Flagged inconsistency** note below.
- **PQF admission-only output contract (PQF-1.0)** — public PQF output is
  now constrained to exactly `Eligible` / `Review Required` /
  `Insufficient Evidence` / `Not Eligible`. No prior PQF implementation
  existed in posi-engine to correct; this establishes the contract for
  future admission-scoring code.
- **MQS / IRS / CVI diagnostics (DIAG-1.0)** — Metadata Quality Score
  (always /100), Indexing Readiness Score (0–100, technical), Citation
  Visibility Index (infrastructure visibility, not impact) — all verified
  structurally excluded from every scoring/ranking module.
- **International Reach (INTL-1.0)** — the five PJR-SPEC.md § 6 display
  fields, formalized as a standalone descriptive-only module, verified
  structurally excluded from every scoring/ranking module.

### Changed

- **AJR-E 1.0 → AJR-E 1.1** ([AJR-E-1.1-SPEC.md](./AJR-E-1.1-SPEC.md)).
  AJR-E-1.0 stays published as historical record — this is a new version,
  not a rewrite of what 1.0 meant. Bug fixes:
  - Research Integrity no longer credits Authorship/COI oversight from
    "an editorial board exists" — both are now independent evidence items.
  - Infrastructure no longer grants a bonus for OpenAlex Source presence.
  - Publishing Stability's cadence-match sub-score is now a tiered,
    documented, automatic formula (≥90%→5, 75–89%→4, 60–74%→2, <60%→0).
  - Reach & Concentration's author-identity resolution is now ORCID →
    normalized given+family name only — never affiliation-as-identity.
  - Article sample size: minimum 10, **target 30** (was a flat
    most-recent-10), spanning ≥2 issues/periods where available.
- **PSC-CROSSWALK-0.1 → PSC-CROSSWALK-0.2** ([PSC-CROSSWALK.md](./PSC-CROSSWALK.md)).
  `psc_confidence` expands from binary `high`/`low` to four states —
  `high`, `medium`, `low`, `unclassified`. The `high` bar itself
  (concentration ≥15% AND works_count ≥50) is **unchanged**; this is
  additive granularity below that bar. **Flagged judgment call:** the
  framework does not specify the medium/low split precisely — `medium` is
  defined as "concentration gate fully met, but on a sample thinner than
  the `high` bar (≥20 works, <50 works)"; a large, well-sampled journal
  with genuinely no dominant category stays `low`, never `medium` (lack
  of concentration is disqualifying regardless of sample size, matching
  the existing generalist-mega-journal discussion in
  [PSC-CROSSWALK.md](./PSC-CROSSWALK.md) § 4). Only `high`/`verified` may
  enter a ranking peer cohort — this is a genuine bug-fix requirement, not
  new: `low`-confidence classifications were always meant to be excluded
  from cohorts (PSC-CROSSWALK.md § 5), and `src/cohort.mjs` now makes that
  impossible to accidentally skip.

### Flagged inconsistency (not silently resolved)

[AJR-SPEC.md](./AJR-SPEC.md) § 5 states the PSC L3/L2/L1 minimum-cohort
fallback chain applies to "each of the three systems" (E-Q, M-Q, and
Citation Q). [PJR-SPEC.md](./PJR-SPEC.md) § 8 — already published, already
implemented and exercised by the seed-corpus pipeline — defines Citation Q
with a flat `MIN_CATEGORY_SIZE = 20` and **no** Level-1 fallback. Rather
than silently changing Citation Q's already-published behavior to match
AJR-SPEC.md § 5, this rollout kept Citation Q's existing rule unchanged
(`src/quartile-tracks.mjs`'s `rankCitationTrack()` wraps the existing
`rankCategory()` as-is) and applied the full fallback chain only to the
newly-built E-Q/M-Q tracks, which is what the framework's own E-Q/M-Q
sections specify inline. **This needs an explicit decision from the
platform owner** — either PJR-SPEC.md § 8 is amended to add the L1
fallback for Citation Q (a version bump, RANK-1.1), or AJR-SPEC.md § 5 is
corrected to describe Citation Q's actual (flat, no-fallback) rule.

### Not yet changed

- `RANK-1.0` (the midrank/percentile formula itself) is unchanged — E-Q,
  M-Q, and Citation Q all reuse it via
  `src/quartile-tracks.mjs`'s `percentileMidrank()`.
- `PCI-1.0` (PCI/PCI-5/PNCI formulas, citable-items table) is unchanged —
  AJR-M's Citation Performance dimension consumes these values via
  within-category percentiles but does not alter how PCI/PCI-5/PNCI are
  computed.
- `taxonomy/psc/current.json` (`psc_version: 1.0.0`, the category *codes*
  themselves) is unchanged — only classification *confidence* granularity
  changed (PSC-CROSSWALK-0.2), not the taxonomy.
