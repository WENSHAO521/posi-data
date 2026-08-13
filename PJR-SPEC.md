# POSI Journal Reports (PJR) — Release Specification v1.0

This document defines how an annual **POSI Journal Reports (PJR)** release is
produced, what it must contain, and the methodology behind every number in
it. It is itself versioned — see § Methodology Versioning — so that a
citation like *"POSI Journal Reports 2028, PCI 2027 = 3.42"* remains
independently reproducible for as long as this repository exists.

## 1. What a PJR release is

A PJR release is a **frozen, tagged snapshot** — not a live query result.

- `metric_year` — the calendar year the citation data covers (e.g. `2027`).
- `data_cutoff` — the date after which no further citation data for
  `metric_year` is incorporated (e.g. `2027-12-31`).
- Release name — `PJR-{publication_year}.{revision}`, e.g. `PJR-2028.1`. The
  publication year is normally `metric_year + 1`; a `.2`, `.3`, … revision is
  used only for a corrected re-issue of the same metric_year (see § 7).

A release is published as a [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
on this repository, tagged against the exact commit the data was generated
from, with a `manifest.json` asset (§ 2) and compressed data assets (§ 3).
Anyone can `git checkout` that tag, re-run
[posi-engine](https://github.com/WENSHAO521/posi-engine) at the pinned
`engine_commit`, and reproduce the same output.

## 2. Manifest format

Every release includes `manifest.json`:

```json
{
  "release": "PJR-2028.1",
  "metric_year": 2027,
  "data_cutoff": "2027-12-31",
  "released": "2028-06-15",
  "psc_version": "1.0.0",
  "pci_methodology_version": "PCI-1.0",
  "ranking_methodology_version": "RANK-1.0",
  "data_commit": "<git sha of posi-data at generation time>",
  "engine_commit": "<git sha of posi-engine used to generate this release>",
  "journal_count": 18432,
  "metric_eligible_journal_count": 14621,
  "category_count": 44,
  "supersedes": null
}
```

`supersedes` is set to a prior release name only for a corrected re-issue
(§ 7); it is `null` for a normal annual release.

## 3. Release assets

Large/bulk data ships as compressed assets attached to the release (not
committed as Git objects — see the repo README and
[GitHub's large-file guidance](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)):

```
manifest.json
SHA256SUMS
posi-journals-{release}.jsonl.gz
posi-classifications-{release}.csv.gz
posi-metrics-{release}.csv.gz
posi-rankings-{release}.csv.gz
```

Smaller, structural data (schemas, taxonomy, per-journal/per-category
records under `journals/`, `metrics/`, `rankings/`) is committed directly to
this repository, sharded (§ 4) to stay Git-friendly.

## 4. Sharding

`journals/`, `metrics/`, and `rankings/` are sharded by the last byte of the
journal id's hash to keep individual directories and diffs manageable as
coverage grows:

```
journals/core/<shard>/<journal_id>.json
metrics/<metric_year>/<shard>/<journal_id>.json
rankings/<metric_year>/<shard>/<journal_id>.json
```

`<shard>` is a 2-character lowercase hex prefix (`00`–`ff`, 256 shards).
Discovered-but-unreviewed journals live separately under
`journals/discovered/*.jsonl` (append-only JSON Lines, not one-file-per-journal
— see `schema/journal.schema.json`, `status: "discovered"`).

## 5. Citable items

Only these `document_type` values count toward the PCI denominator:

| document_type | Citable? |
|---|---|
| research-article | Yes |
| review-article | Yes |
| systematic-review | Yes |
| meta-analysis | Yes |
| data-article | Yes |
| editorial | No |
| letter | No |
| correction | No |
| retraction-notice | No |
| news | No |
| book-review | No |
| meeting-abstract | No |

Every work record carries `document_type`, `metric_eligible` (boolean), and
`metric_exclusion_reason` when `metric_eligible` is false, so the denominator
for any journal/year is fully inspectable — not just a number.

## 6. Metrics

**PCI (POSI Citation Impact)** — the flagship, 2-year metric:

```
PCI[Y] = (citations received in Y to citable items published in Y-1 and Y-2)
         / (count of citable items published in Y-1 and Y-2)
```

**PCI-5** — same formula, 5-year publication window (Y-1 through Y-5).

**PNCI (POSI Normalized Citation Indicator)** — cross-field comparability:

```
PNCI = journal's citation rate / expected citation rate for its primary
       PSC category and metric_year
```

`PNCI = 1.00` means "at the category average." PNCI is a comparison tool; it
is never used in place of PCI as the flagship number, and it is never used to
rank journals against each other outside their own category.

**International Reach** fields (`author_countries`, `citing_countries`,
`international_collaboration_share`, `international_citation_share`,
`largest_author_country_share`) are reported alongside metrics but are
**never** incorporated into PCI, PCI-5, PNCI, or ranking — see
`schema/metric.schema.json`. The goal is to let a reader judge whether a
journal is international or regional in scope without that judgment being
silently baked into its citation-impact score.

## 7. Retractions

A retracted document:

- **Remains** in the dataset — the scholarly record is not deleted.
- **Remains** in the citable-items denominator if it was citable when
  published (retracting a paper must never *raise* a journal's PCI by
  shrinking the denominator).
- Citations **to** a retracted document, and citations **from** a retracted
  document, are excluded from the PCI numerator from the retraction date
  forward.

If a retraction is discovered after a PJR release has been published and it
would change a published PCI/ranking by more than the correction threshold
defined in posi-engine's methodology docs, POSI issues a revision release
(`PJR-{year}.2`, etc.) with `supersedes` set — the original release is never
edited in place.

## 8. Ranking, percentile, and quartile

Within a single PSC category and metric_year:

1. Rank all `metric_eligible` journals by PCI, descending.
2. Assign **mid-rank** to tied PCI values (all journals tied at the same PCI
   receive the same percentile — ties are never broken arbitrarily to force
   an even quartile split).
3. Percentile:

   ```
   percentile = 100 * (category_size - rank_mid + 0.5) / category_size
   ```

4. Quartile: `Q1` if percentile ≥ 75, `Q2` if ≥ 50, `Q3` if ≥ 25, else `Q4`.

**Minimum category size:** a category must have at least
**`MIN_CATEGORY_SIZE = 20`** metric-eligible journals before quartiles are
assigned at all. Below that, `ranking_method` is `"unavailable"` and the
journal record shows *"Ranking unavailable — insufficient category size"*
rather than a misleadingly small-sample Q1.

A journal with 1 primary + up to 2 secondary PSC categories receives one
ranking record per category — the same journal can be Q1 in one field and Q3
in another (see `schema/ranking.schema.json`).

> **2026-08 note:** this section defines what is now specifically called
> **Citation Q** — one of three independent quartile tracks (alongside
> **E-Q** and **M-Q**, see [AJR-E-1.1-SPEC.md](./AJR-E-1.1-SPEC.md) /
> [AJR-M-1.0-SPEC.md](./AJR-M-1.0-SPEC.md)). All three share this exact
> midrank/percentile algorithm (`posi-engine/src/quartile-tracks.mjs`'s
> `percentileMidrank()`) — only the input score and the display label
> differ. Displayed labels must always be the full track name (`E-Q1`,
> `M-Q1`, `Citation Q1`), never a bare `Q1`. **Resolved rule** (platform
> owner decision, 2026-08-12 — see CHANGELOG.md's "Resolved: Citation Q
> fallback inconsistency" entry and AJR-SPEC.md § 5): E-Q and M-Q use the
> PSC L3≥20 → L2≥20 → L1≥30 minimum-cohort fallback chain; Citation Q does
> not — it keeps this section's flat `MIN_CATEGORY_SIZE = 20` rule at the
> journal's primary PSC category, no Level-1 fallback, unchanged from its
> already-published/already-implemented behavior. The asymmetry is
> deliberate: citation-impact rankings need tighter field-comparability
> than lifecycle composites do.

## 9. Citation integrity and suppression

posi-engine flags, at minimum: abnormal self-citation rate, citation
stacking between journal pairs, citation concentration in a small number of
articles, publisher-level citation clustering, sudden citation spikes, and
citation cartels. A journal under review is marked `status: "suppressed"` in
its metric snapshot (`schema/metric.schema.json`) with a
`suppression_reason` — its POSI Core Collection membership (`status:
"indexed"`) is unaffected; only the metric/ranking is withheld pending
review. POSI does not silently delete a journal's metric history because of
a citation-integrity finding — the suppression itself, and its resolution,
are part of the public record.

## 10. PSC governance

Changes to `taxonomy/psc/*.json` happen only via pull request, reviewed
against: journal scope statements, article topic distribution, and citation
network data. A merged PR that changes category codes bumps the PSC version;
`taxonomy/psc/current.json` is updated in the same PR. Historical
`metrics/`/`rankings/` records keep the `psc_version` they were computed
under — reclassifying a journal does not retroactively rewrite past
rankings.

## 11. Methodology versioning

`pci_methodology_version`, `ranking_methodology_version`, and `psc_version`
are independent version strings. Any change to a formula, threshold, or
citable-items table in this document requires a version bump and a CHANGELOG
entry — a metric snapshot's methodology version is permanent, so a reader
can always tell whether two PCI values across years were computed the same
way.

## 12. Journal identity and deduplication

`POSI-J-######` ids are permanent — see `registry/README.md` for the full
identity-resolution priority (ISSN-L first, falling back through canonical
ISSN pair, OpenAlex Source ID, other stable source ids, then manual review).
Two rules that follow from that:

- An id is never derived from a source file's row order or array index. Bulk
  ingestion always resolves identity against `registry/journal-id-map.csv`
  first; only an identity with no existing match mints a new id.
- Before any bulk migration into `journals/`, a dry run produces a Migration
  Audit Report (duplicate groups by ISSN-L/title/publisher overlap, missing
  ISSN-L, invalid ISSN checksums, unresolved identities) for review. No
  `POSI-J-######` ids are minted from a dry run — only after the report has
  been reviewed does a real migration commit registry rows and journal
  records together.
- A journal-record removal (wrong-ISSN correction against seed data, or a
  confirmed publisher rename/retitling) never orphans the old id silently.
  `registry/superseded-ids.csv` records `old_posi_id → superseded_by_posi_id`
  — the old registry row itself is untouched (still historically accurate),
  but any future resolution of the old identity value should follow through
  to the surviving id. Two records merely sharing an upstream signal (e.g.
  an OpenAlex Source id) with no confirmed chronological handoff between
  them are NOT superseded — see `registry/README.md`.
