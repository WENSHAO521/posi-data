# AJR-E 1.1 — POSI Automated Journal Rating, Early-Stage Model

> **Status: implemented in posi-engine** (`src/ajr-early-stage.mjs`,
> `AJR_E_METHODOLOGY_VERSION = 'AJR-E-1.1'`), covered by unit tests
> (`test/ajr-early-stage.test.mjs`). Part of the **"POSI Journal Evaluation
> & Ranking Framework 1.0"** methodology overhaul.
>
> **This is a new version, not a silent edit of AJR-E-1.0.** AJR-E-1.0 (the
> rubric described in [AJR-SPEC.md](./AJR-SPEC.md) § 2 and
> [EARLY-STAGE-RATING-SPEC.md](./EARLY-STAGE-RATING-SPEC.md) § 4, AJR v0.3's
> 100-point model) **stays published as-is** — every score already computed
> under it keeps `methodology_version: "AJR-E-1.0"` and is never
> retroactively reinterpreted. Every score computed by this spec stamps
> `methodology_version: "AJR-E-1.1"`. The two are never conflated in
> display or in ranking cohorts (an E-Q cohort mixing 1.0 and 1.1 scores
> would be comparing journals on two different rubrics).

## 1. Why 1.1, not a patch to 1.0

AJR-E-1.0 had four real bugs, each independently confirmed against the
implementation before this spec was written:

1. **Research Integrity double-counted editorial governance.** The scorer
   gave +3 of the 15-point Research Integrity dimension automatically
   whenever `editorialBoard` evidence was present — treating "has a
   governing board" as a proxy for "has an Authorship Policy and a COI
   Policy," two entirely different disclosures. A journal could score full
   marks on authorship/COI oversight with zero actual evidence that either
   policy exists.
2. **Infrastructure rewarded OpenAlex indexing.** A flat +4 of the 15-point
   Infrastructure dimension was granted whenever the journal had an
   OpenAlex Source record. OpenAlex indexing is a decision made by an
   external platform's own editorial process — it says nothing about
   *this* journal's own DOI resolution, metadata completeness, or
   preservation practices, and blending it in let two unrelated things
   (OpenAlex's judgment and POSI's own quality signal) masquerade as one
   number.
3. **Cadence match had no defined formula.** "Does actual publication
   cadence match the stated frequency" was scored by an ad hoc gate, not a
   documented, reproducible tiered rule.
4. **Author identity used affiliation as a fallback for author identity.**
   Reach & Concentration's "recurrent author" check used
   `orcid ?? affiliation` as the author's identity key — meaning ten
   different authors who happen to share one institution could be
   miscounted as one author appearing ten times, conflating institution
   concentration with author concentration.

AJR-E-1.1 fixes all four, plus widens the article sample (§ 6).

## 2. Scope — unchanged from AJR-E-1.0

Applies to journals in the **Early-Stage** lifecycle stage (12–59 months
since first regular scholarly publication — see [lifecycle boundary
rules](#9-lifecycle-boundary-note), LIFECYCLE-1.1). 100 points, 7
dimensions, weights unchanged from AJR-E-1.0:

| Dimension | Weight |
|---|---:|
| 1. Editorial Governance & Peer Review | 15 |
| 2. Research Integrity | 15 |
| 3. Metadata & Digital Infrastructure | 15 |
| 4. Publishing Stability & Operational Performance | 15 |
| 5. Scholarly Output Quality Signals | 20 |
| 6. Scholarly Reach & Concentration | 10 |
| 7. Transparency & Access Policy | 10 |
| **Total** | **100** |

Every evidence-backed item below is scored through the shared **Evidence
Coverage** normalizer (see the framework's Evidence Coverage section /
`src/evidence-coverage.mjs`): a per-item status of `Met` / `Not Met` /
`Unknown` / `Blocked` / `Not Applicable` / `Conflicted` / `Stale` — never a
binary found/not-found — and

```
DimensionScore = DimensionWeight × (MetEvidenceWeight / ResolvedApplicableEvidenceWeight)
```

An item POSI genuinely could not check (`Unknown`/`Blocked`, e.g. a
publisher platform returning HTTP 403) is excluded from the resolved
denominator, not scored as failed. `Not Applicable` items are removed from
the applicable-weight denominator entirely.

## 3. Dimension 1 — Editorial Governance & Peer Review (15)

| Item | Weight |
|---|---:|
| Aims & Scope explicit | 2 |
| Editorial Board public | 3 |
| Editor identity/affiliation verifiable | 2 |
| Peer Review process/type disclosed | 4 |
| Reviewer/Editorial Guidelines | 2 |
| Complaints & Appeals | 2 |

Unchanged in substance from AJR-E-1.0/AJR v0.3 — reweighted item
granularity for clarity, same underlying evidence categories.

## 4. Dimension 2 — Research Integrity (15) — BUG FIX

| Item | Weight |
|---|---:|
| Publication Ethics/Misconduct policy | 3 |
| Corrections & Retractions | 3 |
| Authorship/Contributorship policy | 2 |
| Conflict of Interest policy | 2 |
| Plagiarism/Similarity policy | 2 |
| Human/Animal Ethics & Consent | 1 |
| Data Availability/Sharing | 1 |
| AI Use Policy | 1 |

**Authorship/Contributorship policy and Conflict of Interest policy are
now independently evidenced items.** There is no code path that credits
either from "an editorial board exists" — each defaults to `Unknown` (not
`Met`) until a real, specific policy is found.

## 5. Dimension 3 — Metadata & Digital Infrastructure (15) — BUG FIX

| Item | Weight |
|---|---:|
| DOI resolution reliability | 3 |
| Crossref core metadata completeness | 3 |
| Abstract/reference/license metadata | 3 |
| Structured author/affiliation identifiers | 2 |
| OAI-PMH/Schema.org/machine-readable metadata | 2 |
| Digital preservation/archiving | 2 |

**No OpenAlex-indexing item or bonus exists in this dimension, full stop.**
`robots.txt` presence is surfaced as a **diagnostic display field only**
(`robotsTxtDiagnostic()` in the engine) — it carries zero scoring weight
here or anywhere else in AJR-E.

## 6. Dimension 4 — Publishing Stability & Operational Performance (15) — BUG FIX

| Item | Weight | Basis |
|---|---:|---|
| Publication frequency disclosed | 2 | Evidence item |
| Actual cadence matches stated frequency | 5 | **Computed, tiered** — see below |
| Publication continuity | 3 | Computed, proportional to active rolling windows |
| Output adequacy | 3 | Computed, proportional to expected minimum output |
| DOI/metadata deposit timeliness | 2 | Evidence item |

**Cadence match (5 pts) — automatic, tiered formula:**

```
≥90% of expected publication windows met  → 5
75–89%                                     → 4
60–74%                                     → 2
<60%                                       → 0
```

**Continuity and output adequacy are proportional, not a formula the
framework specifies exactly** — flagged judgment call: continuity scores
`3 × (active windows / total windows)`; output adequacy scores
`3 × min(1, articleCount / expected)` where `expected = max(10,
monthsSinceLaunch / 2)`. Both are documented in code
(`computeContinuityScore`, `computeOutputAdequacyScore`) specifically so a
reviewer can propose a different formula for these two sub-items without
touching the cadence formula, which IS fully specified by the framework.

**The `max(10, ...)` floor (not `max(1, ...)`) is a deliberate fix, not
the original formula.** § 7 below requires a minimum article sample of 10
for the Scholarly Output Quality Signals dimension to score at all — a
`max(1, ...)` floor let a 12-month-old journal reach `expected = 6` and
score full Output Adequacy marks on only 6 articles, undercutting the
platform's own 10-article minimum in the same rubric. `max(10, ...)`
closes that gap: a 12-month-old journal now needs 10 articles (not 6) for
full marks, consistent with § 7's floor, while a journal old enough that
`monthsSinceLaunch / 2` already exceeds 10 is unaffected.

## 7. Dimension 5 — Scholarly Output Quality Signals (20)

| Item | Weight |
|---|---:|
| Article structural completeness | 6 |
| Reference integrity/completeness | 4 |
| Article type/title/abstract integrity | 3 |
| Duplicate/template anomaly detection | 3 |
| Authorship-pattern anomaly | 2 |
| Publication/date-pattern consistency | 2 |

**Sample size increased: minimum 10, target 30** (up from a flat
most-recent-10), spanning at least two issues/time periods where that data
is available (`assessArticleSampleAdequacy()`). Below the minimum of 10,
this dimension scores 0 with an explicit "insufficient sample" note — not
a silent best-effort score on too little data. Structural/scientific
correctness of any individual article is never assessed — only structural
hallmarks of real, non-templated, individually-reviewed scholarship.

## 8. Dimension 6 — Scholarly Reach & Concentration (10) — BUG FIX

| Item | Weight | Tiers |
|---|---:|---|
| Institution Concentration | 4 | ≤40%→4, 40–60%→3, 60–80%→1, >80%→0 |
| Recurrent Author Concentration | 3 | ≤25%→3, 25–40%→2, 40–60%→1, >60%→0 |
| Institutional Breadth | 3 | proportional to unique-institution ratio |

**Author identity resolution is now ORCID → normalized given+family name,
never affiliation.** `resolveAuthorIdentity()` returns `null` (excluded
from the author-concentration count entirely) when neither an ORCID nor a
full given+family name is available — such authors still count toward
institution concentration via their affiliation string, but never toward
"how many times has this same person appeared," which affiliation cannot
answer. This never rewards "more countries" — it only flags
over-concentration risk in either dimension.

## 9. Dimension 7 — Transparency & Access Policy (10)

Never rewards "must be open access" — any access model is fine, the
requirement is disclosure:

| Item | Weight |
|---|---:|
| APC/subscription/publication-fee disclosure | 2 |
| Copyright & licensing | 2 |
| Access model disclosure | 1 |
| Publisher ownership/contact | 2 |
| Author guidelines | 1 |
| Advertising/sponsorship disclosure | 1 |
| Other applicable terms | 1 |

**Identical criteria to [AJR-M-1.0-SPEC.md](./AJR-M-1.0-SPEC.md) § 6** —
implemented once (`shared-dimensions.mjs`'s `scoreTransparency()`) and
imported by both models, so the two can never drift apart on a dimension
that's supposed to be the same. Items that are genuinely Not Applicable
enter the applicable-weight normalization rather than scoring as a
penalty.

## 10. Lifecycle boundary note

AJR-E applies to the **Early-Stage** window: `launch_date + 12 months ≤
rating_date < launch_date + 60 months`, using exact date-boundary
arithmetic (LIFECYCLE-1.1, `src/lifecycle.mjs`) — not calendar-month
counting, which was found to misjudge journals near a month-end launch
date (e.g. launched 2025-08-31, wrongly counted as 12 months old on
2026-08-01). See the framework document's Lifecycle section for the full
worked example.

## 11. E-Q ranking

AJR-E score → Primary PSC (gated on `psc_confidence` = `high`/`verified`
only — see § 12 below) → Early-Stage peer cohort → rank → mid-rank →
percentile → **E-Q1–E-Q4**, using the shared RANK-1.0 midrank/percentile
formula (`src/quartile-tracks.mjs`'s `rankLifecycleTrack()`). Never a fixed
absolute-score cutoff. Minimum cohort: PSC L2 ≥20, else PSC L1 ≥30, else
"score valid, quartile unavailable" (`src/cohort.mjs`).

## 12. PSC confidence gate

Only `psc_confidence: "high"` (or a human-`verified` classification) may
enter an E-Q peer cohort — `medium`/`low`/`unclassified` may still display
a suggested category but are never used to rank. See
[PSC-CROSSWALK.md](./PSC-CROSSWALK.md) § "PSC-CROSSWALK-0.2" for the
4-state confidence model this gate depends on.

## 13. Changelog

**1.1** (this document) — see § 1 for the four bug fixes and § 7 for the
sample-size increase. Supersedes the AJR-E portion of AJR-SPEC.md § 2 /
EARLY-STAGE-RATING-SPEC.md § 4 for any score computed from this point
forward; those documents' AJR-E-1.0 content remains the accurate
historical record of what 1.0 computed.

**1.0** — AJR v0.3's 100-point rubric, formally scoped to the 12–59 month
Early-Stage window by AJR-SPEC.md. See EARLY-STAGE-RATING-SPEC.md's own
changelog for v0.1/v0.2/v0.3 history.
