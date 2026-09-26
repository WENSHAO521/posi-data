# GLOBAL-INDEX 1.0 — Indexing scope and the global journal pipeline

> **Status: specified; pipeline scripts in posi-engine `scripts/global/`,
> tested on samples. Full run pending.** Adopted by platform-owner
> decision, 2026-09-26.

## 1. Indexing scope

POSI indexes **every journal that has DOIs registered with Crossref or a
source record of type `journal` in OpenAlex.** Indexing is automatic; a
journal does not apply to be indexed.

Within the index there are two public tiers:

| Tier | How a journal gets there | What it adds |
|---|---|---|
| **Indexed** | Automatic (§ 1) | Journal page, publications, PCS and PCS-Q ranking when data suffices, certificates of indexing for its articles |
| **Core Collection** | Applies for certification and passes PQF editorial evaluation | Curated record, published evidence and PQF report, lifecycle rating (AJR-E / AJR-M, E-Q / M-Q), badges |

The existing corpus files keep their meaning as *record sources*:
`corpus/core-collection.json` is the certified tier; `corpus/global-benchmark.json`
and `journals/discovered/` are curated records of indexed journals. None of
them bounds the index.

## 2. Identity

- Journals with a curated record keep their permanent `POSI-J-######` id.
- Registry-only journals are keyed by **ISSN-L** (from OpenAlex, else the
  first ISSN Crossref lists), prefixed `ISSNL-` in pipeline files
  (e.g. `ISSNL-0002-7863`; a hyphen, not a colon, so the key is a valid file name on every platform). They are **not** minted POSI-J ids by this
  pipeline; minting stays a reviewed, audited registry operation.
- **An ISSN is required for indexing**, as in the major citation
  databases. OpenAlex sources typed `journal` without an ISSN are mostly
  conference and meeting collections, and Crossref journal entries without
  one carry no identifier to de-duplicate on; neither is indexed.
- Merging across Crossref and OpenAlex happens on ISSN only (any ISSN in
  common), never on title similarity (consistent with the initial journal
  migration rules).

## 3. Pipeline

posi-engine `scripts/global/`:

1. `harvest-openalex-snapshot.mjs` — reads every source from the public
   OpenAlex snapshot (`s3://openalex/data/jsonl/sources/`, no API budget)
   and keeps the journals (≈207,000 records). `harvest-openalex-journals.mjs`,
   a cursor over the API, remains for limited test runs. Either keeps ids, ISSNs,
   publisher, country, OA / DOAJ flags, APC, works count, and the topic
   profile, and assigns a PSC category and confidence with
   `psc-classify.mjs`'s `classifyPsc()` (the same classifier the curated
   corpus uses).
2. `harvest-crossref-journals.mjs` — cursor over Crossref `/journals`
   (≈171,000 records); keeps title, publisher, ISSNs, DOI counts.
3. `build-global-corpus.mjs` — merges both on ISSN (§ 2), attaches the
   POSI-J id where a curated record exists, and writes a corpus file in the
   shape `run-pcs-etl.mjs` already consumes.
4. `run-pcs-etl.mjs` (existing, resumable) over the global corpus —
   PCS-1.0 for every journal, unchanged method.
5. `run-pcs-q.mjs` (existing) over the global PCS output — the global
   PCS-Q edition.

Journals present in Crossref but not OpenAlex have no PSC classification
and therefore receive an overall PCS-Q rank only (`no_psc_category`).

## 4. Where the outputs live, and how they move

Each repository writes only to itself; the next one pulls. No
cross-repository credentials are needed.

1. **posi-engine** (`.github/workflows/global-index.yml`, daily) publishes a
   release of its own repository tagged `global-index-<cycle>`: the
   compressed global corpus as soon as it exists, then the PCS-Q edition,
   run summaries and PCS shards when the cycle completes.
2. **posi-data** (`.github/workflows/import-global-index.yml`, daily) imports
   the newest complete release: the edition into `rankings/pcs-q/` and the
   summaries into `audits/global-index/<cycle>/`. Bulk files stay attached to
   the posi-engine release and are never committed here.
3. **posi-data-delivery** (`sync-from-posi-data.yml`, daily) builds a new
   immutable snapshot with `scripts/publish-data-snapshot.mjs` when posi-data
   has changed since the current snapshot.
4. The **website** downloads the current ranking edition from the data layer
   and the global corpus from the posi-engine release before each build.
   The same release carries `openalex-profiles.jsonl.gz` (titles, homepage,
   APC, citations per year, h-index, top topics per journal), from which the
   build writes the journal profile pages' data shards and the journal title
   index.

## 5. Politeness and resumability

All harvesters use the Crossref and OpenAlex polite pools (`mailto`),
bounded concurrency, retry with backoff, and on-disk cursors so an
interrupted run resumes instead of restarting. The PCS ETL's existing
per-journal checkpointing (see `run-pcs-etl.mjs`) applies unchanged.

## 6. Changelog

- **GLOBAL-INDEX-1.0** (2026-09-26) — initial version.
