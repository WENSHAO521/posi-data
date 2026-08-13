# AJR 1.0 — POSI Automated Journal Rating, Lifecycle Framework (design spec, Phase 1 methodology freeze)

> **2026-08 update — Phase 2 (engine migration) has landed for the core
> rubrics.** The concrete scoring models this document sketches now have
> real, implemented, versioned specs: **[AJR-E-1.1-SPEC.md](./AJR-E-1.1-SPEC.md)**
> (§ 2 of this document, formerly AJR v0.3's rubric, with four bug fixes)
> and **[AJR-M-1.0-SPEC.md](./AJR-M-1.0-SPEC.md)** (§ 3 of this document,
> resolving § 13's open question about AJR-M's non-citation sub-scoring
> formulas — that model did not exist in code before now). Lifecycle
> classification (§ 1) is implemented as `LIFECYCLE-1.1` in
> `posi-engine/src/lifecycle.mjs`, using exact date-boundary arithmetic
> rather than calendar-month counting (fixes a real boundary bug — see
> [CHANGELOG.md](./CHANGELOG.md)). Evidence Coverage (§ 6) is implemented
> as `EC-1.0`. This document's own body is left as the original design
> record — see the two new specs and CHANGELOG.md for what's actually
> built and versioned.
>
> **Status: design spec only, not yet implemented.** This supersedes the
> lifecycle-blind approach in EARLY-STAGE-RATING-SPEC.md (AJR v0.3): a
> single 100-point model with a hard `rated`/`rated_mature` split at 36
> months, where mature journals get the same score as new ones and simply
> route to a different quartile system. AJR 1.0 replaces that with two
> distinct scoring models — journals are evaluated differently depending on
> how much publication history they actually have, not scored identically
> and then just labeled differently afterward.
>
> This is a **Phase 1 (methodology freeze) document** in POSI's own
> six-phase rollout plan: define the methodology completely before touching
> the engine, PSC wiring, evidence infrastructure, or frontend. See § 9 for
> the full phase breakdown and what's explicitly deferred.

## 1. Lifecycle stages — defined in months, not "years," to avoid boundary ambiguity

| Stage | Age | Rated? | Quartile track |
|---|---|---|---|
| **Observation** | 0–11 months | No | None — too early to evaluate meaningfully |
| **Early-Stage** | 12–59 months | Yes, via AJR-E | E-Q1–E-Q4 |
| **Mature** | ≥60 months | Yes, via AJR-M | M-Q1–M-Q4 |

**Age basis**: *First Regular Scholarly Publication Date* — never ISSN
registration date, website launch date, or POSI coverage-start date.
Resolution priority:

```
Publisher-verified publication date
  → Earliest Crossref-registered regular scholarly article
  → Earliest OpenAlex-indexed regular scholarly work
  → Other verifiable archival evidence
  → Unknown (no lifecycle stage assigned)
```

Editorial announcements, calls for papers, and front-matter don't count as
"first publication." A journal's age does **not** reset on: publisher
change, title change (same continuous bibliographic entity), or a
publication gap followed by resumption. It **does** reset (treated as a
new entity) on a genuine merger or split that creates a new bibliographic
identity.

**E-Q does not convert into M-Q at the 60-month boundary.** A journal is
`E-Q1` one year and, once it crosses 60 months, is evaluated fresh under
AJR-M — it might land `M-Q1`, `M-Q3`, or anything else. Both are correct;
they measure different things at different maturity. A journal's full
history (`2027: Early-Stage, E-Q2`, `2028: Early-Stage, E-Q1`, `2030:
Mature, M-Q2`, ...) should be shown, not hidden, once rating releases
exist to populate it.

## 2. AJR is a framework, not one model

**AJR — POSI Automated Journal Rating** — is now the umbrella name. Two
concrete models sit under it:

- **AJR-E** (Early-Stage) — is the AJR v0.3 100-point rubric, unchanged in
  substance, just formally scoped to the 12–59 month window it was always
  implicitly designed for (see EARLY-STAGE-RATING-SPEC.md § 4 for the full
  per-dimension breakdown: Editorial Governance 15, Research Integrity 15,
  Infrastructure 15, Publishing Stability 15, Scholarly Output Signals 20,
  Reach & Concentration 10, Transparency 10).
- **AJR-M** (Mature) — a new model, § 3 below, that weights real
  accumulated citation performance heavily instead of treating a mature
  journal the same as a brand-new one.

Both remain 100% automated per the existing governing principle (see
EARLY-STAGE-RATING-SPEC.md § 5): no reviewer, editor, publisher, sponsor,
or POSI administrator has a code path to directly set a score, percentile,
or quartile in either model. Only evidence can be corrected.

## 3. AJR-M — why mature journals need a different model

A 2-year-old journal with a 93/100 AJR-E score and a 28-year-old journal
with strong, sustained citation performance for two decades are not
comparable on the same axis — AJR-E has no way to reward decades of actual
demonstrated academic impact, because it was designed for journals that
don't have any citation history yet. Continuing to score mature journals
on "how complete are your policy pages" alone wastes the exact data
(citation history) that makes a mature journal's evaluation trustworthy in
the first place.

| AJR-M Dimension | Weight |
|---|---:|
| Citation Performance & Field-Normalized Impact | 35 |
| Scholarly Output & Publishing Stability | 20 |
| Editorial Governance & Research Integrity | 15 |
| Metadata & Digital Infrastructure | 10 |
| Scholarly Reach & Concentration | 10 |
| Transparency & Openness | 10 |
| **Total** | **100** |

Citation Performance (35, the largest single block) breaks down further:

```
PCI performance                    15
PCI-5 sustained performance        10
PNCI field-normalized impact       10
```

**AJR-M is not a repackaged PCI ranking.** It's a composite where citation
performance is the largest single input (appropriately, for a journal with
enough history to have real citation data) but not the only one — a mature
journal with strong citations and poor governance/integrity/transparency
should not automatically top the Mature ranking. This is what makes AJR-M
distinct from — and complementary to, not redundant with — the independent
Citation Quartile (§ 4).

## 4. Citation Quartile stays fully independent

PCI-based Citation Quartiles (Q1–Q4, per PJR-SPEC.md's existing rank →
midrank → percentile → quartile algorithm, RANK-1.0, `MIN_CATEGORY_SIZE =
20`) are **not replaced or absorbed by AJR-M.** A mature journal can — and
often will — show different results on both:

```
AJR-M Score        91.3 / 100
Mature Quartile     M-Q1

PCI                 4.22
Citation Quartile   Q2
```

Reading: top-tier overall development/governance/stability, but citation
impact specifically is currently second-tier. Or the reverse:

```
AJR-M Score        76.8 / 100
Mature Quartile     M-Q3

PCI                 8.62
Citation Quartile   Q1
```

Reading: citation impact is excellent, but governance/transparency/
infrastructure has real gaps. **This divergence is a feature, not a
inconsistency to resolve** — it's more informative than a single blended
number, and it's the reason POSI runs three tracks (AJR-E, AJR-M, Citation
Q) instead of one.

## 5. One ranking algorithm, three labels

All three quartile systems (E-Q, M-Q, Citation Q) use the identical
midrank-percentile algorithm already specified in PJR-SPEC.md's RANK-1.0 —
only the input score differs (AJR-E score / AJR-M score / PCI) and only
the label differs:

```
Score (all eligible journals in a PSC category + lifecycle-stage cohort)
  → Rank → Midrank → Percentile
  → ≥75th percentile: Q1-equivalent (E-Q1 / M-Q1 / Q1)
  → ≥50th: Q2-equivalent
  → ≥25th: Q3-equivalent
  → <25th: Q4-equivalent
```

No fixed score-to-quartile table (`90+ = Q1`) for any of the three — that
is a grade band, not a quartile, and was already explicitly rejected for
Citation Q in PJR-SPEC.md.

**Peer group = PSC category × lifecycle stage.** A Medicine Early-Stage
journal is never ranked against a Medicine Mature journal, or against a
History Early-Stage journal.

**E-Q and M-Q get a fallback chain; Citation Q does not — this is a
deliberate, platform-owner-confirmed asymmetry, not an oversight.** For
E-Q and M-Q: PSC L3 ≥20 → use L3; else PSC L2 ≥20 → use L2; else PSC L1
≥30 → use L1; else no quartile — the score is still shown (`AJR-E Score:
84.6, Quartile unavailable — insufficient peer group`), never forced.
Citation Q uses a flat `MIN_CATEGORY_SIZE = 20` at the journal's primary
PSC category with **no Level-1 fallback** (PJR-SPEC.md § 8,
`src/quartile-tracks.mjs`'s `rankCitationTrack()`) — below 20 eligible
journals in-category, Citation Q is `unavailable`, full stop, it never
widens to a broader category the way E-Q/M-Q do.

**Why the asymmetry:** Citation Q measures citation impact specifically,
which is far more sensitive to field norms than a lifecycle composite
score is — folding "Political Science + Education + Sociology" into one
"Social Sciences" cohort to hit a fallback quota would compare citation
rates across fields with genuinely different baseline citation behavior,
which is exactly the kind of category-mixing PNCI's field-normalization
exists to prevent elsewhere. E-Q/M-Q are lifecycle-stage composites (only
partly citation-driven for M-Q, not at all for E-Q), so a broader-but-
still-real peer group is an acceptable tradeoff there in a way it isn't
for a pure citation-impact ranking. **This resolves the inconsistency this
section previously stated (that all three tracks share one fallback
chain) — see CHANGELOG.md's "Resolved: Citation Q fallback inconsistency"
entry for the prior open question and its resolution.**

## 6. Evidence Coverage — separating "low score" from "insufficient data"

The Global Benchmark Collection run (600 journals) found that ~73% of
still-failing journals were blocked by HTTP 403 at the crawl level, not
missing evidence (see EARLY-STAGE-RATING-SPEC.md § 0.3). Conflating "the
crawler was blocked" with "no evidence of governance exists" is exactly
the kind of thing a credible rating system cannot do. AJR 1.0 introduces:

**Evidence Coverage** = resolved evidence weight ÷ applicable evidence
weight × 100, shown alongside every score:

```
AJR-E Score          87.6 / 100
Evidence Coverage     94%
```

or, when coverage is too low to trust the score:

```
AJR-E Score          Not available
Evidence Coverage     41%
Reason                Publisher platform blocked automated retrieval
```

Coverage thresholds:

| Coverage | Status |
|---|---|
| ≥80% | Official AJR score, eligible for ranking |
| 60–79.9% | Provisional score shown, not eligible for ranking/quartile |
| <60% | Not rateable |

**Mandatory evidence** (journal identity, ISSN, publication age, an
article sample, lifecycle classification, absence of a known severe
integrity issue) must resolve regardless of overall coverage percentage —
80%+ coverage with a mandatory item unresolved still doesn't produce a
ranked score.

## 7. Expanded status model — replacing the single `eligibility` field

v0.3's `eligibility: 'rated' | 'rated_mature' | 'not_yet_rateable' |
'unknown'` conflated several different questions into one field. AJR 1.0
separates them:

```json
{
  "collection_status": "core",
  "lifecycle_stage": "early_stage",
  "rating_status": "rated",
  "metric_status": "not_yet_eligible",
  "evidence_status": "complete"
}
```

- `collection_status`: `none` | `benchmark` | `core`
- `lifecycle_stage`: `observation` | `early_stage` | `mature`
- `rating_status`: `not_evaluated` | `provisional` | `rated` | `blocked` |
  `insufficient_evidence` | `suppressed`
- `metric_status`: `not_eligible` | `eligible` | `suppressed` (for Citation
  Q eligibility specifically — independent of `rating_status`)
- `evidence_status`: `complete` | `partial` | `blocked` | `insufficient` |
  `conflicted` | `stale`

**`blocked` is not `insufficient_evidence`.** A journal whose platform
returns HTTP 403 gets `rating_status: 'blocked'`, `evidence_status:
'blocked'` — explicitly distinct from a journal that responded but
genuinely lacks published policies (`insufficient_evidence`). Both are
distinct from `suppressed` (an integrity issue triggered manual
suspension, see § 8) — three different reasons a score might be missing,
three different things a reader should conclude from each.

## 8. Publisher Evidence Registry — solving the bot-blocking problem without a headless browser

Rather than trying to defeat bot protection (rejected in
EARLY-STAGE-RATING-SPEC.md § 0.3), large publishers often have policies
that apply uniformly across their journals — a Publication Ethics policy
stated to cover "all Elsevier journals," for instance. Where a publisher
explicitly states a policy's scope, POSI can verify it **once** and let
every journal within that stated scope inherit it, instead of re-crawling
the same publisher-wide policy per journal (which was never going to work
through bot-blocking anyway).

```json
{
  "publisher": "Example Publisher",
  "policy": "Publication Ethics",
  "scope": "all_journals",
  "evidence_url": "https://...",
  "verified_at": "2026-08-09",
  "applies_to_rules": ["AJR-RI-01", "AJR-RI-04"]
}
```

**Inheritable** (publisher-wide policies genuinely can apply uniformly):
research integrity, corrections/retractions, authorship, COI, AI-use
policy, data policy.

**Never inheritable** (inherently journal-specific, no publisher-wide
policy can substitute): editorial board, peer-review model, journal scope,
publication frequency, journal-specific APC. These must always come from
journal-level evidence.

Every evidence item, wherever it comes from, is tagged with its source
type: `journal_web` | `publisher_policy` | `crossref` | `openalex` |
`opencitations` | `ror` | `journal_submission` | `verified_external` — so
a reader (or an appeal reviewer) can always see not just *what* was found
but *where it came from*.

## 9. Six-phase rollout (this document is Phase 1)

1. **Methodology freeze** (this document + PSC-CROSSWALK.md) — lifecycle
   definitions, AJR-E/AJR-M formulas, Evidence Coverage, the status model.
   No large-scale UI changes yet.
2. **Engine migration** — move lifecycle classification, the evidence
   resolver, AJR-E, AJR-M, and ranking out of the website repo's
   `scripts/rate-early-stage.mjs` into `posi-engine` (§ 10). The website
   repo should only ever *display* results, not compute them, long-term.
3. **PSC classification at scale** — already started (PSC-CROSSWALK.md,
   run against Core Collection + the 600-journal Global Benchmark).
4. **Evidence infrastructure** — Publisher Evidence Registry, the
   `blocked`/`insufficient_evidence` status split, Evidence Coverage
   scoring, an appeals path — then *re-run* the benchmark corpus to measure
   real improvement (e.g. 55/600 → some meaningfully higher number is the
   actual proof this phase worked).
5. **Frontend overhaul** — homepage, a real Ratings Overview page splitting
   Early-Stage / Mature / Citation rankings, the full journal-profile
   lifecycle section, methodology pages, a verification tool.
6. **Pilot release** — "POSI Journal Lifecycle Ratings — Pilot 2026/2027,"
   benchmark-validated, before any "Official Release 1.0" claim.

## 10. Where the code should eventually live

Long-term target (not immediate — this is Phase 2):

- **`posi-engine`**: `lifecycle.mjs`, `evidence/resolver.mjs`,
  `evidence/coverage.mjs`, `evidence/publisher-policy.mjs`,
  `ajr/early-stage.mjs`, `ajr/mature.mjs`, `ajr/eligibility.mjs`,
  `psc-classify.mjs`, `ranking.mjs` (shared across E-Q/M-Q/Citation Q —
  only the input score changes), `pci.mjs`, `release.mjs`.
- **`posi-data`**: journal records, evidence records, PSC, methodology
  specs, rating snapshots, ranking snapshots, release manifests.
- **Website repo**: display only.

`scripts/rate-early-stage.mjs` and `scripts/classify-psc.mjs` living in
the website repo today is a known, accepted interim state, not the
intended final architecture.

## 11. Governing principle (unchanged, restated)

> Evidence can be corrected. Scores, ranks, percentiles, and quartiles
> cannot be manually overridden.

A POSI administrator **can**: correct a wrong URL, confirm a publisher
policy's stated scope, correct an ISSN, accept appeal evidence, flag stale
evidence. A POSI administrator **cannot**: change a score, rank,
percentile, or quartile directly — there is no field in the data model for
that, by design, not by policy alone.

## 12. Naming change: P-Q → E-Q

"P-Q" (Provisional Quartile) is retired in favor of **E-Q** (Early-Stage
Quartile) — "Provisional" stopped being accurate once AJR-M exists as a
distinct, non-provisional track for mature journals; E-Q isn't a
placeholder for a future "real" quartile, it's a permanent, distinct
system answering a different question than Citation Q.

## 13. Open questions before implementation

- ~~Exact AJR-M sub-scoring formulas for the non-citation 65 points~~ —
  **resolved**, see [AJR-M-1.0-SPEC.md](./AJR-M-1.0-SPEC.md). Citation
  Performance's within-category-percentile approach (not raw PCI/PCI-5/
  PNCI values) is the answer to "how does a naturally-high-citation field
  avoid dominating," which this question had left open.
- Publisher Evidence Registry governance: who verifies a publisher-wide
  policy's stated scope, and how is a dispute over "does this policy
  really apply to journal X" resolved without becoming a de facto manual
  override?

## 14. Global Benchmark Collection membership is not ranking eligibility

`corpus/global-benchmark.json` (2026-08: 1000 curated seed records, now
4289 after the Elsevier and Frontiers bulk-ingest expansions — see
`audits/migrations/elsevier-jnlactive-expansion-2026/` and
`audits/migrations/frontiers-expansion-2026/`) is a large external sample
used to validate the pipeline against real, messy publisher data at
scale. A record's presence in this file, or its `is_external_benchmark:
true` flag, is **never** itself a signal that a journal is ready for or
eligible for a published quartile.

**Frozen rule:** ranking-cohort eligibility (E-Q, M-Q, Citation Q) is
determined *only* by collection eligibility + lifecycle stage + PSC
classification (`psc_confidence` high/verified — see `cohort.mjs`) +
Evidence Coverage eligibility + cohort-size rules (§ above, and
`posi-engine/src/cohort.mjs`). Confirmed as of 2026-08-12: no code in
`posi-engine/src` reads `is_external_benchmark` or otherwise branches on
Global Benchmark file membership for any eligibility decision — cohort
building goes strictly through `buildPeerCohorts()`/
`isRankEligiblePscConfidence()`. This section exists to keep it that way:
bulk-ingesting an entire publisher's active-journal list (3433 Elsevier
rows, 234 Frontiers rows) skews the *sample's* publisher distribution
heavily — that's fine for a validation corpus, but would silently corrupt
a ranking cohort if anything ever built one directly from "everything in
global-benchmark.json" instead of going through the real eligibility
pipeline.

**Implemented 2026-08-13.** Bulk-ingested publisher records now carry an
explicit `benchmark_source_group: "publisher_expansion"` /
`collection_status: "discovered"` pair (the original curated seed gets
`benchmark_source_group: "curated_benchmark_seed"`), distinguishing them
from the original curated seed set without every future reader having to
independently rediscover this rule from `source_note` presence. Named
`benchmark_source_group` rather than the shorter `source_group` this
paragraph originally proposed, since `core-collection.json` already has
an unrelated `source_group` field (`psg`/`indexed`/`shiharr`/
`other_indexed` — which curation batch a Core Collection journal came
from) — reusing that name on `global-benchmark.json` for a different
concept would have made the two easy to confuse.
- Whether Evidence Coverage's 60%/80% thresholds are right, or need
  calibration against the actual coverage distribution once the evidence
  resolver (source-tagged, multi-source) exists — today's crawl-only
  approach doesn't yet produce a real coverage percentage to calibrate
  against.
- ~~Whether Citation Q should get the same L3/L2/L1 fallback chain as
  E-Q/M-Q~~ — **resolved**, see § 5 above: Citation Q deliberately keeps
  its existing flat rule, no fallback.
