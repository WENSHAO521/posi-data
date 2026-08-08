# posi-data

Canonical, versioned data for **POSI (Panorama Open Scholarly Index)**: journal
records, the POSI Subject Classification (PSC), annual citation metrics, and
subject-category rankings.

This repository — not a database server — is the source of truth. Every
number POSI publishes (PCI, PCI-5, PNCI, subject rank, percentile, quartile)
traces back to a specific commit and, for frozen annual results, a tagged
**POSI Journal Reports (PJR)** release in this repo.

> **Status: schema design phase.** The schemas, taxonomy, and release
> specification in this repo are v1.0 drafts, open for review before the
> first data migration and calculation run. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## What lives here

| Path | Contents |
|---|---|
| `schema/` | JSON Schema definitions for every record type POSI publishes |
| `taxonomy/psc/` | POSI Subject Classification — versioned, PR-reviewed |
| `journals/` | Journal records (sharded JSONL — see below) |
| `metrics/` | Annual per-journal metric snapshots (PCI, PCI-5, PNCI, …) |
| `rankings/` | Annual per-category rankings (rank, percentile, quartile) |
| `manifests/` | One manifest per PJR release, pinning data/engine commits |
| `PJR-SPEC.md` | The annual release specification |

## What does *not* live here

Bulk citation-graph data (works, references, citation edges) is expected to
reach a scale (hundreds of millions of edges) where committing it as Git
objects is impractical — see [GitHub's large-file guidance](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).
That data is published as compressed Parquet/CSV assets attached to
[GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
instead of committed to the repository history. See `PJR-SPEC.md`.

## Design principles

1. **Open data.** Every journal record, classification, metric, and ranking
   POSI publishes is here, in a plain-text, diffable format.
2. **Open methodology.** How PCI is computed, which document types count
   toward the denominator, how ties are broken, how quartiles are assigned —
   all documented in `PJR-SPEC.md` and versioned alongside the data it
   describes.
3. **Reproducibility over real-time.** POSI does not recompute rankings on
   every page load. A PJR release is a frozen snapshot: `git checkout` the
   tag, re-run [posi-engine](https://github.com/WENSHAO521/posi-engine)
   against the pinned commit, and you should get the same numbers.
4. **Provenance, not re-licensing.** Data POSI aggregates from upstream open
   infrastructure (Crossref, OpenAlex, OpenCitations, DOAJ, ROR) keeps its
   own `source` / `license` / `retrieved_at` fields — POSI does not
   relabel third-party data as its own.

## Related repositories

- [posi-engine](https://github.com/WENSHAO521/posi-engine) — the PSC
  classifier, PCI/PNCI calculators, and ranking engine that reads this repo
  and produces the contents of `metrics/` and `rankings/`.
- [Panorama-Open-Scholarly-Index](https://github.com/WENSHAO521/Panorama-Open-Scholarly-Index) —
  the POSI website (Next.js), which consumes generated data at build time.

## License

- Structured data POSI has produced or curated (`schema/`, `taxonomy/`,
  `metrics/`, `rankings/`, `manifests/`): [CC BY 4.0](./LICENSE-DATA).
- Journal records aggregated from upstream sources retain the license and
  attribution of their origin — see each record's `provenance` field.
