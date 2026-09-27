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

## 2026-09-27 — POSI-ZONES 1.0 (trial)

### Added

- **POSI-ZONES-1.0** ([POSI-ZONES-1.0-SPEC.md](./POSI-ZONES-1.0-SPEC.md)) —
  POSI Zones (POSI 分区): the PCS-Q ranks divided into tiers of 5%, 15%, 30%
  and 50%, within each category and overall, beside the PCS quartiles.
  Published as a trial; the release of record accompanies the December
  POSI-R release.

## 2026-09-27 — POSI-R-2026.1, the first official release

### Added

- **POSI-R-2026.1** ([`releases/POSI-R-2026.1/manifest.json`](./releases/POSI-R-2026.1/manifest.json)),
  published 2026-09-27 with data cutoff 2026-09-27: 4,320 corpus journals
  (30 Core Collection, 1 candidate, 993 curated Global Benchmark, 3,296
  publisher-catalog), PCS for 4,089, PCI for 992, and the PCS-Q 2026
  edition (4,067 ranked overall, 2,963 by category). Generated from
  posi-data `38390f4` with posi-engine `4754d59`.
- **Release manifests carry `files`** ([POSI-R-1.0-SPEC.md](./POSI-R-1.0-SPEC.md) § 4):
  collection checksums that define the release's content.

### Changed

- **`scripts/publish-data-snapshot.mjs`** publishes a snapshot whose
  collections match the newest release as `official_release`, and one
  built from later data as `post_release_data_snapshot`; `current.json`
  names the latest release. It now records `PSC-CROSSWALK-0.3`, the
  crosswalk in force.

## 2026-09-27 — PSC-CROSSWALK 0.3

### Changed

- **PSC confidence gate** ([PSC-CROSSWALK.md](./PSC-CROSSWALK.md) § 3):
  `high`/`medium` now need a ≥ 35% category share and a ≥ 1.5× lead over
  the runner-up (was ≥ 15% share). Old general journals carry long tails
  of noisy OpenAlex topics; the 15% bar filed *The Lancet* under P5.02
  Business/Economics with `high` confidence, which put it in that
  category's ranking cohort.

### Added

- **`multidisciplinary`** confidence state (§ 4): full-sample journals
  with no dominant category and either no dominant domain (< 50%) or a
  best category under 30% without a clear lead. Display-only; not
  rank-eligible. PCS-Q records for these journals carry
  `category_code: null` and `exclusion_reason: "multidisciplinary"`.

Effect on the 2026-09-23 OpenAlex snapshot (195,661 classified journals):
`high` 148k → 77,273; `multidisciplinary` 30,019; `medium` 12,231;
`low` 76,138. Rank-eligible cohorts shrink accordingly; every PCS-Q
category rank from the next cycle onward uses 0.3.

## 2026-09-26 — PCS-Q 1.0 and GLOBAL-INDEX 1.0

Platform-owner decision: POSI publishes journal rankings for every indexed
journal, Core and non-Core, and indexes every journal registered with
Crossref or OpenAlex.

### Added

- **PCS-Q-1.0** ([PCS-Q-1.0-SPEC.md](./PCS-Q-1.0-SPEC.md)) — a fourth
  quartile track: RANK-1.0 applied to PCS, labelled `PCS-Q1`…`PCS-Q4`.
  Eligibility: PCS present, ≥ 5 eligible items, fetch coverage ≥ 0.9;
  category rank additionally needs high/verified PSC confidence and a
  category of ≥ 20 journals. First edition `rankings/pcs-q/pcs-q-2026.json`
  (4,067 overall-ranked, 3,864 category-ranked in 20 categories).
- **GLOBAL-INDEX-1.0** ([GLOBAL-INDEX-1.0-SPEC.md](./GLOBAL-INDEX-1.0-SPEC.md))
  — indexing scope (all Crossref / OpenAlex journals), the Indexed / Core
  Collection tiers, ISSN-L keys for registry-only journals, and the global
  harvest → corpus → PCS → PCS-Q pipeline.

### Changed

- **PCS-1.0-SPEC.md § 1** — PCS now determines PCS-Q (only). PCS formula
  unchanged; version stays `PCS-1.0`.
- **AJR-SPEC.md § 14** — note extending the membership-is-not-eligibility
  rule to PCS-Q and the global index.

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
  the **Resolved: Citation Q fallback inconsistency** note below.
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

### Resolved: Citation Q fallback inconsistency

**Platform owner decision (2026-08-12):** Citation Q keeps its existing
flat `MIN_CATEGORY_SIZE = 20` rule with **no** Level-1 fallback, unchanged
from its already-published behavior (`src/quartile-tracks.mjs`'s
`rankCitationTrack()`). E-Q and M-Q keep the full L3→L2→L1 fallback chain.
This was previously an open inconsistency between AJR-SPEC.md § 5 (which
stated all three tracks shared one fallback chain) and PJR-SPEC.md § 8
(which already implemented Citation Q's flat rule) — no code changed as a
result of this decision (`rankCitationTrack()` was already correct);
[AJR-SPEC.md](./AJR-SPEC.md) § 5 has been corrected to describe the actual
asymmetric rule, with the rationale (citation-impact rankings need
tighter field-comparability than lifecycle composites do) recorded there.
No version bump — RANK-1.0's actual behavior was already correct; only
AJR-SPEC.md's prose was wrong.

### Added (2026-08-12 consolidation pass)

- **PCS 1.0** ([PCS-1.0-SPEC.md](./PCS-1.0-SPEC.md)) — POSI Citation
  Score, a Crossref-based 4-year citation-performance indicator,
  independent of the PCI family. Never enters Citation Q or AJR-M's
  citation component. Removes the earlier informal 200-item sampling cap.
  `schema/metric.schema.json` gains `pcs` / `pcs_window_start_year` /
  `pcs_window_end_year` / `pcs_eligible_items` /
  `pcs_items_with_citation_data` / `pcs_coverage` / `pcs_source` /
  `pcs_source_retrieved_at` / `pcs_methodology_version`. Calculator
  (`src/pcs.mjs`) implemented in posi-engine; the Crossref data-acquisition
  script is not yet built (separate, larger-scope data-pipeline work).
  **Pre-merge review fix:** § 10's retraction-handling text originally
  contradicted the actual implementation (it claimed a retracted work's
  own citation count was excluded; the code and its test always included
  it, matching PCI's "stays in the denominator" rule but without PCI's
  ability to filter individual citing works). § 10 now describes the
  code's actual, deliberate behavior; § 11 (new) adds a Crossref
  citation-coverage disclosure — PCS is Crossref-observed, not a complete
  citation census.
- **POSI-R 1.0** ([POSI-R-1.0-SPEC.md](./POSI-R-1.0-SPEC.md)) — the
  platform-wide release naming/manifest convention
  (`POSI-R-{year}.{revision}`), distinct from and referencing (not
  replacing) PJR's existing citation-only release format. Defines the
  component-version fields a POSI-R manifest pins, and that a component
  being `Pending` (most likely PCI/PJR, while OpenAlex access is
  unavailable) does not block the rest of a release from shipping.

### Fixed (2026-08-12 consolidation pass)

- **AJR-E 1.1 Output Adequacy floor** ([AJR-E-1.1-SPEC.md](./AJR-E-1.1-SPEC.md)
  § 6, `posi-engine/src/ajr-early-stage.mjs`'s `computeOutputAdequacyScore()`).
  The expected-article-count floor was `max(1, monthsSinceLaunch / 2)`,
  which let a 12-month-old journal reach full Output Adequacy marks on
  only 6 articles — undercutting the same rubric's own 10-article minimum
  sample size (§ 7). Changed to `max(10, monthsSinceLaunch / 2)`. Caught
  before any AJR-E-1.1 score was computed in production (blocked on real
  evidence-pipeline data), so this is an in-place fix to the still-unused
  1.1 spec, not a 1.2 version bump — see AJR-E-1.1-SPEC.md's own status
  banner for why 1.1 itself is versioned separately from 1.0.

### Clarified (no behavior change)

- **`verified` PSC confidence** ([PSC-CROSSWALK.md](./PSC-CROSSWALK.md)
  § 5, rewritten). The `posi-engine` code already correctly implemented
  `verified` as a human-confirmation-only state, rank-eligible alongside
  `high` (`RANK_ELIGIBLE_PSC_CONFIDENCE = new Set(['high', 'verified'])`,
  never auto-assigned by `classifyPsc()`) — this document's prose simply
  hadn't caught up to describe it as a real fifth state. No code changed.

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
