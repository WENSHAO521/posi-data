# PCS 1.0 — POSI Citation Score

> **Status: calculator implemented in posi-engine** (`src/pcs.mjs`,
> `PCS_METHODOLOGY_VERSION = 'PCS-1.0'`), covered by unit tests
> (`test/pcs.test.mjs`). Part of the **"POSI Journal Evaluation & Ranking
> Framework 1.0"** methodology overhaul.
>
> **The Crossref data-acquisition script (cursor-paginated fetch of
> `is-referenced-by-count` per DOI) is not yet built.** `src/pcs.mjs` is a
> pure calculator — same shape as `pci.mjs` — that takes an already-fetched
> array of works and returns a PCS value; it does not call the Crossref API
> itself. Building the fetch script and running it against the full corpus
> is separate, larger-scope data-pipeline work, tracked independently of
> this spec freeze.

## 1. What PCS is, and is not

**PCS is an independently reported Crossref-based 4-year citation-
performance indicator.** It exists alongside the PCI family (PCI, PCI-5,
PNCI — see PJR-SPEC.md § 5–6) as a second, deliberately separate signal,
not a replacement or a component of it.

**PCS does not determine POSI Citation Rank, Citation Percentile, or
Citation Quartile.** Citation Q is computed from PCI alone (AJR-SPEC.md
§ 5, `src/quartile-tracks.mjs`'s `rankCitationTrack()`). **PCS does not
enter AJR-M's 35-point Citation Performance component** (AJR-M-1.0-SPEC.md
§ 2, which is PCI/PCI-5/PNCI percentiles only). PCS is never averaged,
blended, or used to correct PCI, PCI-5, or PNCI, and vice versa.

Every PCS display on the platform carries this line, verbatim:

> **PCS is independently reported and does not determine POSI Citation
> Rank, Citation Percentile, or Citation Quartile.**

## 2. Why a second citation indicator at all

PCI/PCI-5/PNCI are OpenAlex-graph-based and depend on OpenAlex API access
(subject to OpenAlex's own quota/availability, which has at times been the
blocking factor for shipping any citation data at all — see CHANGELOG.md).
Crossref's `is-referenced-by-count` is a second, independently maintained
citation count, sourced from a different aggregator with different
coverage characteristics. Reporting both — clearly separated, never mixed
— gives the platform a citation signal that can ship even when OpenAlex
access is degraded, and gives readers a cross-check between two
independently computed numbers instead of a single point of failure.

## 3. Data source

**Crossref REST API** (`api.crossref.org`), the `is-referenced-by-count`
field on each work record — Crossref's own aggregate citation count for
that DOI, populated from publishers and other sources depositing citation
data with Crossref. This is a single aggregate integer per DOI, not a
per-citing-work list.

## 4. Eligible works

Same normalized citable-document-type set PCI uses (PJR-SPEC.md's citable-
items table, `pci.mjs`'s `isCitable()` / `CITABLE_DOCUMENT_TYPES`) —
`pcs.mjs` reuses `isCitable()` directly rather than defining a second,
possibly-drifting eligibility rule. The data-acquisition script (§ 8) is
responsible for normalizing Crossref's raw `type` field (`journal-article`,
`proceedings-article`, ...) into the same `document_type` values PCI's
OpenAlex-based normalization already produces, so a work's eligibility
never depends on which citation graph happened to describe it.

## 5. Publication window — 4 complete publication years, no sampling cap

For a PCS snapshot with `metric_year = Y`, eligible works are everything
published in years **`Y-4` through `Y-1`** (four complete calendar years,
`Y` itself excluded because it is not yet complete). Example: a 2026
release snapshot covers works published in 2022, 2023, 2024, and 2025.

**No 200-item sampling cap.** An earlier PQF-era implementation capped PCS
computation at a 200-article sample; PCS 1.0 removes that cap entirely —
every eligible work in the 4-year window is included, so a large journal
and a small journal are compared on the same basis (a sampled average
systematically understates a high-volume journal's true citation profile
relative to a low-volume one, and vice versa is not a safe assumption
either — the fix is simply not sampling).

## 6. Formula

```
PCS = ( Σ is_referenced_by_count over eligible works )
      ───────────────────────────────────────────────
      ( count of eligible works )
```

A straight mean over the full eligible set — no percentile normalization,
no field adjustment (unlike PNCI). PCS is reported as a plain per-article
average citation count for the window, on purpose: it is meant to be
legible on its own terms, not another field-normalized composite.

## 7. Missing `is-referenced-by-count`

Two distinct situations, handled differently — **`unknown` ≠ zero**,
matching the framework's Evidence Coverage principle elsewhere
(AJR-SPEC.md § 6):

- **The work was fetched successfully but Crossref reports no
  `is-referenced-by-count` field, or reports it as `0`.** Crossref
  genuinely tracks 0 as a valid count (a real DOI with no known citing
  works yet). Treated as `0` and **included** in both the numerator sum
  and the denominator count — this is a real data point, not missing data.
- **The work could not be fetched at all** (API error, malformed/missing
  DOI record, rate-limit exhaustion mid-pagination). **Excluded** from
  both numerator and denominator — never silently counted as a 0-citation
  work, which would understate PCS. The data-acquisition script must
  record which DOIs were skipped and why, so a partial-coverage PCS
  snapshot is distinguishable from a complete one (see `pcs_coverage` in
  § 9).

## 8. Data acquisition (not yet built)

The eventual fetch script must:

1. Enumerate eligible DOIs for a journal's 4-year window (§ 5) from the
   journal's existing article corpus.
2. Cursor-paginate Crossref's works API (`cursor=*`) to retrieve every
   eligible DOI's current `is-referenced-by-count` — no page-count or
   item-count cap.
3. Normalize each work's Crossref `type` into the shared `document_type`
   taxonomy (§ 4) before calling `isCitable()`.
4. Record `snapshot_date`, the count of DOIs that failed to fetch (§ 7),
   and pass the resulting works array to `calculatePcs()`
   (`src/pcs.mjs`) — the fetch script does not compute PCS itself.

This script, and running it against the real corpus, is separate,
larger-scope work — explicitly out of scope for the spec-freeze pass this
document is part of.

## 9. Snapshot fields

Adds to `schema/metric.schema.json` (alongside the existing `pci` /
`pci_5yr` / `pnci` fields, § below):

- `pcs` — the computed value, or `null` if no eligible works exist.
- `pcs_eligible_items` — denominator: count of eligible works actually
  included (§ 7's fetch-failures excluded).
- `pcs_coverage` — the fraction of enumerated eligible DOIs that were
  successfully fetched (`pcs_eligible_items / (pcs_eligible_items +
  failed_fetch_count)`), so a reader can tell a 40%-coverage PCS apart
  from a 100%-coverage one. This is separate from, and not fed into, the
  platform's general Evidence Coverage model (AJR-SPEC.md § 6), which
  governs AJR-E/AJR-M rating eligibility, not citation-indicator display.
- `pcs_methodology_version` — e.g. `PCS-1.0`, independent of
  `methodology_version` (which describes PCI's version) per PJR-SPEC.md
  § 11's "independent version strings" rule.

## 10. Corrections and retractions — a known, disclosed limitation

PCI excludes citations to/from retracted content from its numerator
because OpenAlex's citation graph is queryable per citing work (PJR-SPEC.md
§ 7). **Crossref's `is-referenced-by-count` is a single aggregate integer
per DOI — it cannot be filtered to exclude specific citing works.** PCS 1.0
does not attempt to approximate this: a retracted work's own
`is-referenced-by-count` is excluded from PCS the same way a non-citable
document type would be (§ 4's `isCitable()` gate is unaffected by
retraction status, matching PCI's rule that a retracted-but-citable work
stays in the denominator), but citations *to* a retracted work from other,
still-valid articles are not filtered out of those other articles'
`is_referenced_by_count`. This is a disclosed methodological limitation of
Crossref's aggregate count, not an oversight — any journal page displaying
PCS should note that PCS, unlike PCI, cannot exclude retraction-tainted
citations.

## 11. Cross-source diagnostic — future work, not this release

A large divergence between a journal's PCI percentile and its PCS
percentile (e.g. PCI at the 96th percentile, PCS at the 32nd) is a useful
signal for citation-integrity review — but only as a **diagnostic flag**,
never a score adjustment. **This document does not build that diagnostic**
(no `citation-integrity.mjs` change lands with PCS 1.0) — it is listed here
so the eventual implementation has a name (**Cross-Source Citation
Divergence**) and a stated rule to implement against: flag only, never
suppress or adjust automatically.

## 12. Changelog

**1.0** (this document) — first PCS spec. No prior PCS methodology
document existed; an earlier ad hoc 200-item-capped implementation
existed only as informal practice, not a versioned spec, and is
superseded by this document's no-cap rule (§ 5).
