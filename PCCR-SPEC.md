# POSI Journal Citation & Coverage Report (PCCR) — Design Spec v0.1 (Phase C, not yet implemented)

> **Status: design spec only.** Nothing in this document is built yet. It
> depends on real [PSC](taxonomy/psc/) classification and the first
> [PJR](PJR-SPEC.md) release existing — building the report UI before that
> data exists would mean showing fabricated PCI/rank/quartile numbers, which
> POSI does not do (see PJR-SPEC.md's ranking methodology). Tracked here so
> the design isn't lost while the identity/enrichment migration and PSC
> classification work finishes first.

## 1. Why this exists

DOAJ, Scopus, and Web of Science each publish a document a journal can point
to as evidence of its own standing: a DOAJ record, a Scopus Source record, a
JCR entry. POSI's equivalent should not be a "congratulations, you're
indexed" certificate — it should be a real, reproducible data report, in the
same spirit as a JCR profile: sourced numbers, a stated methodology version,
and a pinned data/engine commit a reader can independently re-run.

Two documents cover this, at two levels of detail:

- **POSI Citation Statement** — a short, embeddable/printable summary.
- **POSI Journal Citation & Coverage Report (PCCR)** — the full report.

Naming deliberately avoids "Indexing Certificate" — that phrasing reads as
pay-to-play validation theater, which is exactly the DOAJ-adjacent
credibility problem POSI is trying to distinguish itself from (see
[what-posi-is-not](https://github.com/WENSHAO521/Panorama-Open-Scholarly-Index)).

## 2. POSI Citation Statement (short form)

A compact, single-screen summary meant for a journal's own website, an
editor's CV, or an author verifying a journal's standing. Contents:

```
Journal, ISSN/eISSN, POSI Journal ID, Publisher
POSI Coverage Status: Discovered | Indexed | Metric Eligible
Coverage Since: <year>
PSC Category: <category>              (Metric Eligible only)
Metric Year: <year>                   (Metric Eligible only)

POSI Citation Impact (PCI): <value>   (Metric Eligible only)
Citable Items / Citations Received / PNCI

Subject Rank / Percentile / Quartile  (Metric Eligible only)

Data Release: PJR-<release>
Methodology: PCI-<version> / RANK-<version>
Verification ID: <report id>
```

Every field beyond the identity block (journal/ISSN/POSI-J-id/publisher/
coverage status) is conditional on coverage status — see § 5.

## 3. PCCR (full report)

Six sections:

1. **Coverage** — POSI Journal ID, coverage status, Core Collection
   membership, coverage start, ISSN-L/print/online, publisher, country, PSC
   primary category.
2. **Citation Metrics** — PCI (headline number), PCI-5, PNCI, total
   citations, citable items, PCI-window citations, self-citation rate, %
   cited.
3. **Subject Ranking** — rank/percentile/quartile within the PSC category,
   with the methodology line always present verbatim: *"Quartiles are
   derived from journal percentile rankings within the corresponding PSC
   category"* — never phrased as a fixed score threshold (see PJR-SPEC.md's
   ranking algorithm; this report must not contradict it).
4. **Citation Trend** — PCI/rank/quartile by metric year, once ≥2 years of
   history exist.
5. **Citation Sources** (later addition, needs a citation graph POSI doesn't
   have yet) — top citing journals, top cited articles, citing-country
   count, international citation share.
6. **Methodology & Provenance** — PCI methodology version, ranking
   methodology version, PSC version, `posi-data` commit, `posi-engine`
   commit, PJR release — plus direct links to download the underlying data,
   view the methodology, and view the source code. This section is the
   actual differentiator from a JCR-style report: every number traces to a
   pinned, checkout-able commit.

## 4. Report Verification

A lookup tool (`/verify` or similar): given a report ID (e.g.
`PCCR-2028-000381`), return whether it's authentic and its key facts
(journal, issued date, data release, status). Since POSI is a static-export
site with no backend database, this needs one of:

- A static, build-time-generated `report-index.json` (report id → journal
  code + data release + issued date) that the verification page fetches and
  checks client-side, regenerated on every PJR release; or
- Treat the report ID itself as derived/reconstructible (e.g. a deterministic
  hash of journal code + data release), so "verification" is really
  "regenerate the expected ID and compare" rather than a database lookup.

This needs a concrete design decision before implementation — flagged here,
not resolved.

## 5. Coverage-status-gated disclosure (hard requirement)

The exact same coverage status controls exactly what a report/statement is
allowed to claim — this must be enforced by the report generator, not left
to prose discipline:

| Status | Statement may say |
|---|---|
| Discovered | "Journal record available in POSI." Nothing implying indexing. |
| Indexed | "Indexed in the POSI Core Collection." If insufficient data for metrics: `PCI: Not yet eligible`, `Quartile: Not yet available` — explicit, not blank. |
| Metric Eligible | "Indexed in the POSI Core Collection. Eligible for POSI citation metrics and subject rankings." Full PCI/rank/quartile shown. |

A Discovered-tier record must never be able to produce a statement that
reads as "indexed by POSI" — this is the same discipline already enforced in
the website's Core Collection three-state model.

## 6. Conflict-of-interest disclosure (hard requirement)

Any report/statement generated for a Panorama Scholarly Group journal must
include, verbatim or equivalent:

> Conflict-of-Interest Disclosure: This journal is published by Panorama
> Scholarly Group, which provides infrastructure and financial support to
> POSI. Citation metrics in this report are generated using the same
> published methodology and versioned calculation engine applied to all
> eligible journals.

This is not optional per-report copy — it must be templated so it cannot be
omitted for an affiliated journal by mistake.

## 7. Relationship to DOAJ and other external registries

DOAJ/Scopus/WoS/PubMed listing status may appear in a report's Coverage
section as plain external reference metadata (see the website's equivalent
treatment — DOAJ is never an admission, scoring, or ranking input). A PCCR
is not evidence of DOAJ listing and does not claim to be.

## 8. Open questions before implementation

- Report ID scheme and the verification mechanism (§ 4) — needs a decision.
- Whether Citation Statements/PCCRs are generated at build time for every
  Metric Eligible journal (static files, like badges) or generated on
  request — static generation matches this site's existing architecture
  (badges, PSC pages) and avoids needing any backend.
- PDF export is implied by "printable"/"CV" use cases in the original
  design conversation but not scoped here — client-side print stylesheet
  vs. a real PDF pipeline is an implementation detail to decide later, not a
  spec-level concern.
