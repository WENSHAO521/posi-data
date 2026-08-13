# posi-data

Canonical, versioned data for **POSI (Panorama Open Scholarly Index)**: journal
records, the POSI Subject Classification (PSC), lifecycle ratings (AJR-E/AJR-M),
annual citation metrics, and subject-category rankings.

This repository — not a database server — is the source of truth. Every
number POSI publishes (PCI, PCI-5, PNCI, subject rank, percentile, quartile,
AJR score) traces back to a specific commit and, for frozen annual results, a
tagged **POSI Journal Reports (PJR)** release in this repo.

> **Status (2026-08): real data, actively growing.** 31 Core Collection
> journals (fully indexed, PQF-admitted), 4,289 Global Benchmark Collection
> journals (curated validation seed + a 2026-08 bulk publisher-catalog
> expansion — Elsevier, Frontiers), 23,796 discovered-but-unreviewed journal
> records, 26,000+ permanent `POSI-J-######` identities minted. The "POSI
> Journal Evaluation & Ranking Framework 1.0" (AJR-E 1.1, AJR-M 1.0,
> PSC-CROSSWALK 0.2, lifecycle staging) is frozen and implemented in
> [posi-engine](https://github.com/WENSHAO521/posi-engine). See
> [CHANGELOG.md](./CHANGELOG.md) for the full history.

## What lives here

| Path | Contents |
|---|---|
| `schema/` | JSON Schema definitions for every canonical record type POSI publishes |
| `taxonomy/psc/` | POSI Subject Classification — versioned, PR-reviewed |
| `corpus/` | `core-collection.json` (31, admitted) and `global-benchmark.json` (4,289, external validation corpus) — see `corpus/README.md` |
| `source-lists/` | Raw, unmodified publisher-catalog exports used as bulk-ingestion input (e.g. Elsevier's `jnlactive.csv`, Frontiers' title list) — see `source-lists/README.md` |
| `journals/` | Discovered/canonical journal records (sharded JSONL) |
| `evidence/` | Per-journal, per-criterion Evidence Coverage snapshots (Evidence ETL output) |
| `metrics/` | Annual per-journal metric snapshots (PCI, PCI-5, PNCI, …) |
| `rankings/` | Annual per-category rankings (rank, percentile, quartile) |
| `manifests/` | One manifest per PJR release, pinning data/engine commits |
| `registry/` | Permanent, append-only mapping from stable external identity (ISSN-L, etc.) to `POSI-J-######` id — plus `superseded-ids.csv` (retired-id → surviving-id resolution) and `excluded-identities.csv` (known zero-evidence records) — see `registry/README.md` |
| `audits/` | One directory per migration/ingestion/rating pass — full before/after data, reasoning, and reproducibility steps for every non-trivial change made to this repo |
| `scripts/publish-data-snapshot.mjs` | Publishes a dated snapshot of `corpus/` to [posi-data-delivery](https://github.com/WENSHAO521/posi-data-delivery) — the public, GitHub-Pages-hosted read layer other consumers (including the website) fetch from, so they never have to clone this repo or vendor its files directly |
| `AJR-SPEC.md` / `AJR-E-1.1-SPEC.md` / `AJR-M-1.0-SPEC.md` | The lifecycle-based Automated Journal Rating framework — Early-Stage and Mature tracks |
| `PSC-CROSSWALK.md` | OpenAlex-topic-to-PSC subject classification crosswalk |
| `PJR-SPEC.md` | The annual citation-metrics release specification |

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
   toward the denominator, how ties are broken, how quartiles are assigned,
   how AJR-E/AJR-M score a journal — all documented in `PJR-SPEC.md` /
   `AJR-SPEC.md` and versioned alongside the data they describe.
3. **Reproducibility over real-time.** POSI does not recompute rankings on
   every page load. A PJR release is a frozen snapshot: `git checkout` the
   tag, re-run [posi-engine](https://github.com/WENSHAO521/posi-engine)
   against the pinned commit, and you should get the same numbers.
4. **Provenance, not re-licensing.** Data POSI aggregates from upstream open
   infrastructure (Crossref, OpenAlex, OpenCitations, DOAJ, ROR) keeps its
   own `source` / `license` / `retrieved_at` fields — POSI does not
   relabel third-party data as its own.
5. **A permanent id is never silently orphaned.** `POSI-J-######` ids are
   append-only and never reassigned. A record that turns out to need
   correcting (wrong ISSN, confirmed rename) never just disappears — its old
   id is documented as superseded (`registry/superseded-ids.csv`), never left
   as an unexplained dead end.
6. **Never claim more than was actually computed.** A provisional or
   partially-evidenced figure (e.g. Citation Q computed without a full
   evidence crawl) is always labeled as such, never presented as a finished
   official metric it isn't yet.

## Related repositories

- [posi-engine](https://github.com/WENSHAO521/posi-engine) — the PSC
  classifier, AJR-E/AJR-M rating engine, PCI/PNCI calculators, and ranking
  engine that reads this repo and produces the contents of `metrics/` and
  `rankings/`.
- [posi-data-delivery](https://github.com/WENSHAO521/posi-data-delivery) —
  the public read layer this repo publishes to
  (`scripts/publish-data-snapshot.mjs`), served over HTTPS at
  `data.posi.panorama-sg.com`. Not a source of truth itself — a generated,
  versioned, immutable mirror of `corpus/`, so downstream consumers fetch
  over plain HTTPS instead of cloning this repo or pinning a commit SHA
  directly.
- [Panorama-Open-Scholarly-Index](https://github.com/WENSHAO521/Panorama-Open-Scholarly-Index) —
  the POSI website (Next.js, static export). Reads from posi-data-delivery,
  not this repo directly: small collections are synced into the build at
  `src/lib/*.json` (that repo's `scripts/sync-corpus.mjs`), and the larger
  Global Benchmark publisher-catalog expansion is fetched client-side at
  runtime, never vendored.

## License

- Structured data POSI has produced or curated (`schema/`, `taxonomy/`,
  `metrics/`, `rankings/`, `manifests/`, `corpus/`): [CC BY 4.0](./LICENSE-DATA).
- Journal records aggregated from upstream sources retain the license and
  attribution of their origin — see each record's `provenance` field.
