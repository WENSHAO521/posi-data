# PSC Classification Methodology v0.1 (implemented, journal-level only)

> **PSC-CROSSWALK-0.2 (2026-08):** `psc_confidence` now has four states —
> `high`, `medium`, `low`, `unclassified` — instead of the binary
> `high`/`low` this document originally described. The `high` bar itself
> (§ 3's two gates, unchanged) is not redefined; this is additive
> granularity below it. See [CHANGELOG.md](./CHANGELOG.md) for the full
> rationale and the flagged judgment call on where `medium` starts, and
> `posi-engine/src/psc-classify.mjs` for the implementation. § 5 below
> ("only `high`-confidence classifications should ever be used for
> cohort/quartile membership") now also permits a human-`verified`
> classification — see `posi-engine/src/cohort.mjs`.
>
> **Status:** implemented in
> [`scripts/classify-psc.mjs`](https://github.com/WENSHAO521/Panorama-Open-Scholarly-Index/blob/master/scripts/classify-psc.mjs)
> in the website repo, run against both the Core Collection and the Global
> Benchmark Collection. Assigns one PSC Level-2 category per journal, with
> an explicit `high`/`low` confidence flag — no forced single category for
> journals whose actual output doesn't concentrate into one PSC area.

## 1. Why OpenAlex topic data, not a new classifier

POSI already treats OpenAlex as its core open data source (PCI, article
metadata, identity enrichment). Journal-level `topics` — OpenAlex's own
aggregation of the topics of everything published under a source, each
tagged with a domain/field/subfield and a count — is free via the
singleton lookup (`GET /sources/issn:{issn}`, not the metered filter/list
endpoint) and requires no new data source or licensing question.

## 2. The crosswalk

OpenAlex's topic taxonomy (4 domains → ~26 fields → ~250 subfields) is
mapped to PSC's 42 Level-2 categories via two tables:

- **`FIELD_TO_PSC`** — a direct field → PSC code mapping for fields that
  land in one PSC category unambiguously (e.g. `Mathematics` → `P1.01`,
  `Psychology` → `P5.01`).
- **`SUBFIELD_OVERRIDES`** — checked first, for OpenAlex fields too broad
  to map to one PSC category (`Engineering`, `Social Sciences`, `Arts and
  Humanities`, `Agricultural and Biological Sciences`). E.g. `Engineering`
  alone doesn't say whether a journal is civil, electrical, or mechanical
  — but its subfield (`Civil and Structural Engineering`, `Electrical and
  Electronic Engineering`, ...) does.

A journal's PSC assignment is **not** just its single top-count topic.
All of a journal's topics are mapped through the crosswalk first, then
grouped by resulting PSC code and summed — several distinct OpenAlex
topics/subfields legitimately land in the same PSC category (e.g.
Sociology, Political Science, and Urban Studies subfields all map to
`P5.04`/`P5.06`/`P5.09`), and looking only at the single top topic
understates real concentration. The PSC code with the largest aggregated
count wins.

This crosswalk is v0.1 and known-imprecise at the margins — it is a
mapping between two different classification systems (OECD Frascati FORD
vs. an ASJC-derived scheme), not a lossless translation. Corrections are
expected via the normal PSC governance process (PR against this file).

## 3. Confidence — two independent gates, both must pass for `high`

A `psc_category` is only marked `psc_confidence: 'high'` if **both**:

1. **Concentration** — the winning PSC category's aggregated topic-count
   share of the journal's total topic-count mass is ≥ 15%.
2. **Sample size** — the journal has ≥ 50 total OpenAlex-indexed works.

Both gates are necessary, found the hard way in the same session: a
sample-size-only gate (checking whether the topic-count *total* passed a
threshold) was insufficient — a 41-work journal (`Global Review of
Humanities, Arts, and Society`) classified confidently as **Psychology**,
driven by 4-5 dance-studies-adjacent articles that happened to carry more
topic-model weight than its more scattered humanities output. The
concentration share alone (~35%) looked confident; the underlying sample
was simply too small to trust. Gating on `works_count` (actual publication
volume, not topic-count mass, which scales with topics-per-work and
doesn't track sample size the same way) fixed it — that journal now
correctly reports `low` confidence.

`low` confidence does not mean "no category" — `psc_category` is still
populated as a best-guess, useful for browsing/filtering, but should never
be treated as authoritative for cohort/quartile purposes (see § 5).

## 4. Known limitation: generalist mega-journals

Flagship multidisciplinary journals (*Nature*, *Science*, *The Lancet*,
*JAMA*) publish across every field, sometimes for 150-200 years. Their
aggregate topic distribution genuinely doesn't concentrate into one PSC
category — *The Lancet*'s top-weighted OpenAlex topics include "Aerospace
Engineering" and "Transportation," an artifact of two centuries of
every-subject content, not a data error. These journals correctly report
`low` confidence (or occasionally a plausible-sounding but not
meaningfully "true" category) — this is expected, not a bug to chase.
There is no clean single-PSC-category answer for a journal that is, by
design, about everything.

## 5. Rank-eligible confidence: `high` and `verified`

`psc_category`/`psc_confidence` feed the E-Q, M-Q, and Citation Q peer
cohorts (`posi-engine/src/cohort.mjs`, `isRankEligiblePscConfidence()`).
Only two of the five `psc_confidence` values are rank-eligible:

- **`high`** — the algorithmic classification in § 3, both gates passed
  automatically.
- **`verified`** — a **human-confirmed** classification. This is not a
  fifth confidence tier the algorithm can assign itself; it only ever
  enters the data by a person confirming a classification is correct.
  Critically, `verified` means **confirming a classification fact**, not
  **choosing whichever category is most favorable for a journal's
  ranking** — a reviewer verifies "this journal's primary output really
  is Environmental Sciences," never "let's put this journal in whichever
  category it ranks best in." The distinction matters because `verified`
  carries the same ranking authority as `high`; treating it as a
  discretionary override would let manual classification quietly become
  manual score manipulation, which § 11 of AJR-SPEC.md's governing
  principle ("scores, ranks, percentiles, and quartiles cannot be
  manually overridden") exists specifically to prevent.

`medium`, `low`, and `unclassified` may all still display a
`psc_category` for browsing/filtering, but none of the three may ever
enter a ranking peer cohort — a `medium`/`low`/`unclassified` guess
should not silently determine which peer group a journal is ranked
against.
