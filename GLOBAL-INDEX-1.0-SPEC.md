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
- Merging across Crossref and OpenAlex happens on ISSN only (any ISSN in
  common), never on title similarity (consistent with the initial journal
  migration rules).

## 3. Pipeline

posi-engine `scripts/global/`:

1. `harvest-openalex-journals.mjs` — cursor over OpenAlex
   `/sources?filter=type:journal` (≈207,000 records); keeps ids, ISSNs,
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

## 4. Where the outputs live

The global corpus and global PCS output are bulk, machine-generated files
(hundreds of MB). They ship as checksummed release assets and through
posi-data-delivery snapshots, **not** as files committed to this
repository's history. What is committed here: this spec, the run's audit
summary (`audits/global-index/<run>/`), and the PCS-Q edition when it is
small enough to review.

## 5. Politeness and resumability

All harvesters use the Crossref and OpenAlex polite pools (`mailto`),
bounded concurrency, retry with backoff, and on-disk cursors so an
interrupted run resumes instead of restarting. The PCS ETL's existing
per-journal checkpointing (see `run-pcs-etl.mjs`) applies unchanged.

## 6. Changelog

- **GLOBAL-INDEX-1.0** (2026-09-26) — initial version.
