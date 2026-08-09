# POSI Early-Stage Journal Rating — Design Spec v0.1 (Phase B0, not yet implemented)

> **Status: design spec only.** Captured for a future tracked implementation
> effort, deliberately started only after the current DOAJ-decoupling work
> and the OpenAlex identity migration are in a stable state — this is a
> large enough methodology addition (new rubric, new cohort logic, new
> report/badge) to deserve a clean start rather than being interleaved into
> an already-open change set.

## 1. The problem this solves

Real [Citation Quartiles](PJR-SPEC.md) (Q1–Q4) are computed from PCI, which
needs a real citation window (PCI is a 2-year mean citedness figure — see
`src/pci.mjs`). A journal that launched a few months ago cannot have
accumulated that history. If POSI's only quartile system is citation-based,
a brand-new journal either gets excluded entirely or, worse, gets force-fit
into a Q1–Q4 bucket with near-zero citation counts that reads as
meaningless or (if it lands high by statistical accident) actively
misleading. A screenshot of "Q1" travels without its footnotes — so the
citation-based and non-citation-based ratings must never share a label.

## 2. Two separate quartile systems, never merged into one label

| | Citation Quartile | Provisional Quartile |
|---|---|---|
| Badge/label | `Q1`–`Q4` | `P-Q1`–`P-Q4` (never rendered as bare `Q1`) |
| Eligible journals | Metric Eligible (has PCI) | Early-Stage (see § 3) |
| Basis | PCI, ranked within PSC category | 100-point composite score (§ 4), ranked within a launch cohort (§ 6) |
| Required caption | — | "Provisional Q1 — comprehensive early-stage journal rating, not a citation-based quartile" wherever `P-Q1` appears |
| Transition | — | Does **not** automatically convert to a Citation Quartile once a journal becomes Metric Eligible (§ 8) — a journal can be `P-Q1` one year and `Q2` the next; both are correct, they measure different things |

## 3. Early-Stage eligibility

**Early-Stage Journal** = first regular scholarly content published ≤ 36
months before the rating cutoff date.

Minimum bar to be rated at all (below this: `Not Yet Rateable`, not a forced
low quartile):

- Operating ≥ 6–12 months
- ≥ 10 eligible scholarly articles published
- Explicit peer-review policy published
- Valid, registered ISSN
- Working website
- Verifiable editorial board
- Complete publication-ethics policy
- No known serious research-integrity issue

## 4. 100-point composite score

Replaces PQF's JTF/MQF/EGF/TDF/CVF/RIF subfactor split for this track —
Early-Stage Rating is a distinct methodology, not a PQF variant:

| Dimension | Weight |
|---|---:|
| Scholarly Content & Scope Quality | 25 |
| Editorial Governance & Peer Review | 20 |
| Research Integrity & Publication Ethics | 15 |
| Metadata & Digital Publishing Infrastructure | 15 |
| Publishing Stability & Operational Performance | 10 |
| Scholarly Reach & Diversity | 10 |
| Openness, Data & Transparency | 5 |
| **Total** | **100** |

Notes on the two dimensions most prone to gaming:

- **Scholarly Content (25, highest weight, deliberately)** — must be scored
  from actually reading a sample (10 articles or all published articles,
  whichever is fewer): scope fit, clarity of research questions, basic
  methodological soundness, contribution, reference quality, report
  completeness, and red flags (templated/formulaic content, anomalous
  publication patterns). A rating system that only checks published
  *policies* rather than actual *content* degenerates into "a good-looking
  website = Q1" — this dimension exists specifically to prevent that.
- **Scholarly Reach & Diversity (10)** — must not be a raw count of
  non-domestic editors/authors. A high-quality regional journal (e.g. a
  strong Chinese-language history journal with a mostly-domestic author
  base) must not be penalized into a low tier for that alone. Score
  editor/author/institution diversity, submission geography, and
  concentration risk (over-reliance on one institution) — not
  "foreignness."

## 5. DOAJ and other external registries: zero weight

Same rule as the rest of POSI (see the website's DOAJ decoupling): DOAJ,
Scopus, WoS, and PubMed listing status may be displayed as plain "External
Database Status" metadata, but contribute **0 points** to the composite
score in either direction — listed or not listed, no effect on the score.
This is what makes the Early-Stage methodology POSI's own, not a DOAJ
re-score.

## 6. Cohort-relative ranking, not a fixed score-to-quartile table

**Do not** use a fixed mapping like "90–100 = P-Q1, 80–89 = P-Q2, …" — that
is not a quartile, it's a grade band. A real quartile is relative:

```
Composite Score (all Early-Stage journals in a PSC category + launch cohort)
  → Rank
  → Midrank
  → Percentile
  → P-Q1 (≥75th percentile) / P-Q2 (≥50th) / P-Q3 (≥25th) / P-Q4 (<25th)
```

Same midrank-percentile math as RANK-1.0 (PJR-SPEC.md) — this track reuses
that algorithm, just against the composite score instead of PCI, and against
a cohort instead of the full category.

**Launch cohorts** — do not compare a 3-month-old journal against a
35-month-old one directly. Internally bucket by:

- Cohort A: 0–12 months since launch
- Cohort B: 13–24 months
- Cohort C: 25–36 months

Public-facing display can stay simple — e.g. "Early-Stage Cohort: 2026" —
without exposing the internal A/B/C bucketing, unless there's a reason to.

## 7. Minimum cohort size, with fallback (mirrors RANK-1.0's category-size gate)

1. Try PSC Level 3 if the cohort has ≥ 20 journals at that level.
2. Fall back to PSC Level 2 if that cohort has ≥ 20.
3. Fall back to PSC Level 1 if that cohort has ≥ 30.
4. Otherwise: no quartile assigned. Still show the composite score:
   `Composite Score: 83.4/100 · Rating status: Evaluated · Quartile: Not
   assigned — insufficient peer cohort`. Never force a quartile out of an
   undersized comparison group.

## 8. Status fields — keep coverage, rating, and metric status separate

Do not overload the existing `coverage_status` (Discovered/Indexed/Metric
Eligible) with rating information. Three independent fields:

```json
{
  "coverage_status": "indexed",
  "rating_status": "early_stage_rated",
  "metric_status": "not_yet_eligible"
}
```

A journal's `rating_status` (Early-Stage rated or not) and `metric_status`
(Metric Eligible or not) can both be true at once during the transition
year — that's expected, not a bug. `P-Q1` does not imply or predict `Q1`;
they are computed from different data and are allowed to disagree.

## 9. PSG-affiliated Early-Stage journals: same firewall as elsewhere

If a PSG-published journal receives an Early-Stage rating:

- The content-quality assessment (§ 4's 25-point dimension) must not be
  performed by that journal's own editorial staff.
- At least two independent reviewers required.
- Full scoring evidence published (same "reproducible from a commit"
  standard as PCI/PJR).
- Percentile/quartile computed by the same automated pipeline as every
  other journal — no manual quartile adjustment, ever, for any journal,
  affiliated or not.
- Same `Affiliated Journal Disclosure` requirement as PCCR (see
  PCCR-SPEC.md § 6).

## 10. Open questions before implementation

- Where does the "read 10 sampled articles" content-quality check happen —
  can any part of it be automated (e.g. structural checks: abstract
  presence, reference count, section structure), or is it inherently a
  human review step? If human, this needs a reviewer workflow that doesn't
  exist yet anywhere in POSI's current tooling.
- Exact wording/UI for surfacing `rating_status`/`metric_status` divergence
  (a journal that's `P-Q1` one year and `Q2` the next) without reading as a
  contradiction to a casual visitor.
- Whether Early-Stage Rating needs its own PJR-style annual frozen release,
  or piggybacks on the existing PJR release cadence.
