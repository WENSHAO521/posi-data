# POSI Automated Journal Rating (AJR) — Methodology v0.3 (Phase B0, partially implemented)

> **Naming note:** this document was originally "POSI Early-Stage Journal
> Rating." The underlying 100-point score (§4) applies to any journal
> regardless of age — a journal's age only decides which *quartile track*
> its score feeds into (§ 0.1), not whether it gets scored at all. The
> methodology is now named **AJR (Automated Journal Rating)**; "Early-Stage"
> now refers specifically to the P-Q1–P-Q4 track for young journals, one of
> two quartile tracks AJR scores can feed (the other being Citation Q,
> PCI-based, for journals with a real citation window). File/type names in
> the website repo (`rate-early-stage.mjs`, `EarlyStageRating`) have not
> been renamed yet — tracked as a follow-up, not urgent since it's an
> internal identifier, not user-facing copy.
>
> **Status:** the 100-point automated methodology described below (§4) is
> implemented in
> [`scripts/rate-early-stage.mjs`](https://github.com/WENSHAO521/Panorama-Open-Scholarly-Index/blob/master/scripts/rate-early-stage.mjs)
> in the website repo, wired into the daily sync workflow so any journal
> newly admitted to the Core Collection gets rated automatically within 24h.
> Published live at `/ratings` as **"POSI Automated Journal Ratings — Pilot
> 2026."** As of v0.3, the script also runs against a ~200-journal **Global
> Benchmark Collection** (§ 0.2) selected via OpenAlex's own open signals —
> no Web of Science or Scopus data anywhere in its selection or scoring.
> **Not yet built:** § 6's cohort-relative P-Q1–P-Q4 percentile system (needs
> PSC classification, which hasn't run on any journal yet — same blocker
> real Citation Quartiles have). Until that lands, journals show a
> Composite Score only, no quartile.
>
> **v0.2 superseded v0.1's 65-automated / 35-pending-human-review split**
> (§ 0 for why). **v0.3 decouples scoring eligibility from quartile-track
> eligibility** (§ 0.1) and adds the Global Benchmark Collection (§ 0.2).
> See § 11 for the full changelog.

## 0.1 Scoring applies regardless of age; only the quartile track depends on it

Earlier versions of this script hard-excluded any journal more than 36
months past its first publication — meaning it could not score Nature, The
Lancet, or any other established journal at all. That was a design error,
not a deliberate restriction: a journal's editorial governance, research
integrity, infrastructure, and publishing-stability evidence (§4) is just
as computable for a 150-year-old journal as a 6-month-old one.

`eligibility` now has four values:

| Value | Meaning |
|---|---|
| `rated` | Meets the minimum evidence bar (§3) and is within 36 months of first publication — gets an AJR score **and** is eligible for a future P-Q1–P-Q4 once a real PSC peer cohort exists. |
| `rated_mature` | Meets the minimum evidence bar but is older than 36 months — gets the **same AJR score**, computed identically, but its quartile track is Citation Q (PCI-based), not P-Q. |
| `not_yet_rateable` | Below the minimum evidence bar, regardless of age. No score. |
| `unknown` | First-published date could not be determined (e.g. no resolvable Crossref record for the journal's ISSN). No score. |

Neither `rated` nor `rated_mature` is a quality judgment — they only route
a journal to the correct quartile system.

## 0.2 Global Benchmark Collection

A ~200-journal external reference corpus, kept structurally separate from
the POSI Core Collection: not admitted, not a candidate for admission, not
counted in Indexed/Metric Eligible stats. Its purpose is validating AJR
against journals already broadly agreed to be excellent — the opposite
failure mode of only ever testing the methodology against POSI's own new
journals, and a real risk if AJR's weights happen to reward things new
PSG journals are good at and established journals aren't.

**Selection deliberately does not use Web of Science (SCIE/SSCI/AHCI/ESCI)
or Scopus index membership** — neither is available through any open,
freely-redistributable API. OpenAlex's own schema was checked directly:
`works.indexed_in` only lists `arxiv`/`crossref`/`pubmed`/etc, and `sources`
objects have no `is_indexed_in_scopus` or Web-of-Science field at all.
Building POSI's own "open" benchmark corpus on top of a proprietary
compiled list (Clarivate's Master Journal List, Elsevier's Scopus Source
List — both real, but published for individual reference lookup, not
obviously licensed for bulk redistribution as a derived dataset) would
undercut the exact principle the benchmark exists to demonstrate.

Selection instead uses only OpenAlex's own open signals
(`scripts/discover-benchmark-journals.mjs`):

- `type: journal`
- `is_core: true` — OpenAlex's own curated-core flag
- `summary_stats.2yr_mean_citedness > 1` — real, sustained citation activity

...bucketed across OpenAlex's 4 top-level topic domains (Physical Sciences,
Life Sciences, Social Sciences, Health Sciences) and capped per domain
(default 50 each), so the corpus isn't skewed toward whichever field
happens to have the largest mega-journals by raw output. A publisher name
like "Elsevier" may be shown as plain factual metadata (who publishes the
journal) — this is never conflated with "Scopus-indexed" (Scopus is
Elsevier's separate proprietary database product, not the publisher
relationship).

Expect real-world data noise in this corpus (a resolvable OpenAlex ISSN
that Crossref's `/journals/{issn}/works` endpoint doesn't recognize, a
site that blocks crawlers) — that's expected variance to observe, not a
pipeline bug to suppress.

## 0. Why v0.1's human-scored dimensions were removed, not just deferred

v0.1 reserved 35 of 100 points (Scholarly Content, Scholarly Reach &
Diversity) for human judgment, on the theory that reading articles and
assessing diversity needed a person. On reflection, the actual risk that
matters most for a rating system's credibility isn't "was a human involved
in the underlying evidence" — it's **whether any person can move a
journal's number after the fact**, for any reason, including a good one.
Every path where a human assigns a sub-score directly is a path where that
score can be adjusted informally — for a friend, an advertiser, an
affiliated journal, or just a reviewer having an off day — with no
commit, no diff, no way to prove it didn't happen.

So v0.2's governing rule (see § 5) is: **the composite score is 100%
computed from verifiable evidence by versioned, published code. No person —
reviewer, editor, publisher, sponsor, or POSI administrator — has a code
path to directly set a score, percentile, or quartile.** The two dimensions
that used to be "pending human review" are redesigned below into things
that are genuinely computable from evidence already available (Crossref
article metadata, direct site crawl) — not because reading an article
"doesn't matter," but because a rating system that depends on someone's
literary judgment cannot make the no-manual-adjustment guarantee in the
first place. What a person can still do is correct wrong *evidence* (a
crawler that missed a real retraction policy, a stale Crossref record) —
never touch the *score* directly. See § 5 and § 8.

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

- Operating ≥ 6 months
- ≥ 10 eligible scholarly articles published
- Explicit peer-review policy published
- Valid, registered ISSN
- Working website
- Verifiable editorial board
- Complete publication-ethics policy

## 4. 100-point composite score — fully automated

Replaces PQF's JTF/MQF/EGF/TDF/CVF/RIF subfactor split for this track —
Early-Stage Rating is a distinct methodology, not a PQF variant:

| Dimension | Weight |
|---|---:|
| Editorial Governance & Peer Review | 15 |
| Research Integrity & Publication Ethics | 15 |
| Metadata & Digital Publishing Infrastructure | 15 |
| Publishing Stability & Operational Performance | 15 |
| Scholarly Output Quality Signals | 20 |
| Scholarly Reach & Concentration | 10 |
| Openness, Data & Transparency | 10 |
| **Total** | **100** |

Editorial Governance, Research Integrity, Infrastructure, Publishing
Stability, and Transparency are computed from a direct crawl of the
journal's own website (policy pages, sitemap/robots, DOI resolution) plus
live OpenAlex discoverability — same evidence categories PQF's automated
track already uses, reweighted for this rubric.

### 4.1 Scholarly Output Quality Signals (20) — replaces v0.1's "Scholarly Content"

v0.1 wanted a human to read 10 articles and judge scope fit, methodological
soundness, and contribution. That can't be made evidence-based and
non-adjustable at the same time — literary judgment isn't reproducible from
a commit. Instead, this dimension checks whether a journal's **actual
published articles** (not just its policy pages) show the structural and
integrity signals a functioning peer-reviewed journal should have, sampled
from up to 10 of its most recent Crossref-registered works:

- **Structural completeness** — average, across the sample, of: abstract
  present, non-zero reference count, at least one author with an affiliation
  string, at least one author with an ORCID, license present.
- **Reference integrity** — average reference count per article (a
  near-zero average across real articles is itself a signal, independent of
  what any policy page claims).
- **Publication-pattern anomalies** — near-duplicate titles within the
  sample, a single author name appearing across an implausible share of the
  sample, or all sampled articles clustering on the same publication date
  (batch-dumping). Each detected anomaly reduces this sub-score; a clean
  sample gets full marks.

This is deliberately **not** a claim that POSI verifies an article's
scientific correctness — it verifies that the journal's actual output
exhibits the structural hallmarks of real, non-templated, individually
reviewed scholarship. "A good-looking policy page with thin or anomalous
actual output" now scores lower here even if every other dimension is high.

### 4.2 Scholarly Reach & Concentration (10) — replaces v0.1's "Scholarly Reach & Diversity"

v0.1 worried that automating this would collapse into "more foreign authors
= higher score," unfairly penalizing strong regional journals. v0.2 avoids
that by not measuring internationality at all — it measures **concentration
risk**, computed from the same sampled articles' author affiliation
strings:

- Unique-affiliation-string ratio across the sample (a rough, string-based
  proxy — not institution-ID-normalized, so treat small differences as
  noise, not signal).
- Whether one affiliation string dominates an implausible share of the
  sample (over-reliance on a single institution, regardless of that
  institution's country).

A journal where 90% of sampled authors are affiliated with different
institutions inside a single country scores fine here. A journal where 80%
of sampled articles come from one specific institution does not — same
concern, regardless of geography. **Known limitation, stated plainly:**
Crossref affiliation strings are inconsistently populated; if fewer than
30% of sampled authors have any affiliation string at all, this sub-check
is skipped and a neutral (not zero, not full) score is assigned instead —
missing metadata is a completeness problem already counted elsewhere, not
evidence of concentration.

## 5. Governing principle — evidence may be corrected, scores may not

> **No human reviewer, editor, publisher, sponsor, or POSI administrator
> may directly alter a journal's numerical rating, percentile, or
> quartile.**

What a person *can* do:

- **Correct evidence.** If a crawler missed a real, published retraction
  policy, or a Crossref record is stale, a reviewer verifies the correct
  URL/record and the evidence is corrected — then the engine recalculates
  the score from that corrected input. The person never touches the
  numbers directly.
- **Handle appeals** the same way: a journal disputing its rating points to
  specific wrong evidence; POSI corrects the evidence and reruns the
  pipeline. "The committee felt this journal deserved better" is not a
  valid basis for a score change under this rule.
- **Suspend a rating** on discovering integrity issues (citation stacking,
  a fabricated editorial board, mass-publication anomalies) — suspension
  is a status flag, not a substitute score a person assigns.

`scripts/rate-early-stage.mjs`'s injected `early_stage_rating` field is
machine-generated (see the same "do not hand-edit, correct evidence and
re-run" discipline already used for `discovered-journals.ts`) — the
pipeline has no code path that accepts a manually-supplied score,
percentile, or quartile as input.

DOAJ, Scopus, WoS, and PubMed listing status contribute **0 points** to
this composite in either direction — same rule as everywhere else in POSI
(see the website's DOAJ decoupling).

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
a cohort instead of the full category. This part of the spec is **not yet
implemented** — see the status note at the top.

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

## 9. PSG-affiliated Early-Stage journals: no separate track, same firewall

A PSG-published journal is scored by exactly the same automated pipeline,
against exactly the same evidence rules, as any other Early-Stage journal —
§ 5's no-manual-adjustment rule already prevents the obvious conflict-of-
interest failure mode (nobody, including POSI staff, has a code path to
raise it). Required alongside its rating:

> Affiliated Journal Disclosure: This journal is published by Panorama
> Scholarly Group, which also operates POSI. It is evaluated by the same
> automated methodology, published code, and versioned engine applied to
> every eligible journal. No manual score, percentile, or quartile
> adjustment is permitted for this or any journal.

This is a stronger disclosure than "we found two independent reviewers" —
it doesn't depend on trusting who those reviewers were, only on the
methodology and code being public and reproducible.

## 10. Automation is not a claim of perfect fairness

Automating this removes *relationship-based* distortion — favoritism,
informal score adjustment, undisclosed conflicts. It does not remove *data*
or *design* distortion: crawler misses, Crossref metadata gaps, a metric
that gets specifically gamed once publishers learn what it rewards. POSI's
defense against that class of problem is not "the algorithm is objective"
— it's the same open-infrastructure stack used everywhere else:

```
Open methodology (this document, versioned)
+ Open data (posi-data)
+ Open source engine (posi-engine / the website's scoring scripts)
+ Versioned releases (methodology version stamped on every rating)
+ Correctable evidence, with appeals routed through evidence correction
+ No manual score/percentile/quartile adjustment, ever
```

Claiming outright objectivity invites (correctly) being picked apart by
exactly the kind of scrutiny POSI wants to survive. Claiming
reproducibility and a closed loophole for manual score-fixing is a claim
POSI can actually back up with a git history.

## 11. Changelog

**v0.3** — Renamed the methodology from "Early-Stage Journal Rating" to
"POSI Automated Journal Rating (AJR)" — the 100-point score applies to any
journal, age is only a quartile-track decision (§ 0.1). Fixed a real design
error: scoring previously hard-excluded anything older than 36 months
(`eligibility: 'graduated'`, no score at all), which meant the methodology
literally could not score established journals like Nature or The Lancet —
exactly the journals needed to validate whether AJR's weights are sane.
Split `eligibility` into `rated` (early-stage window, P-Q-eligible) and
`rated_mature` (scored identically, routes to Citation Q instead). Added
the Global Benchmark Collection (§ 0.2): ~200 journals selected via
OpenAlex's own open signals (`is_core`, citation activity, topic-domain
balance) — explicitly not via Web of Science or Scopus membership, which
isn't available through any open, freely-redistributable API. Published
the Core Collection's AJR scores live at `/ratings` as "POSI Automated
Journal Ratings — Pilot 2026."

**v0.2** — Replaced the v0.1 65-automated/35-pending-human-review split
with a fully automated 100-point methodology. "Scholarly Content" (25pts,
human article reading) became "Scholarly Output Quality Signals" (20pts,
automated structural/reference/pattern checks on real Crossref-sampled
articles). "Scholarly Reach & Diversity" (10pts, human diversity judgment)
became "Scholarly Reach & Concentration" (10pts, automated affiliation-
concentration checks, explicitly not a nationality/diversity metric).
Editorial Governance rebalanced 20→15, Publishing Stability 10→15,
Transparency 5→10, to fit the new 100-point total. Added § 0 and § 5's
governing no-manual-adjustment principle. Dropped v0.1's "no known serious
research-integrity issue" eligibility criterion from § 3 (unautomatable as
a negative-evidence check with the tooling that exists today; integrity
issues are instead handled as rating suspension per § 5).

**v0.1** — Initial design spec (superseded).
