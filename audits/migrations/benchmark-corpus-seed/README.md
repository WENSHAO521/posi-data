# Benchmark-corpus seed pipeline run — 2026-08-11/12

Full run of `posi-engine/scripts/run-pjr-seed-pipeline.mjs` over
`corpus/global-benchmark.json` (1000 journals) for `metric_year: 2025`,
completing the `pjr-seed-corpus-1000` task. This directory is the dry-run
identity audit + non-official sample computation this run produced — see
`posi-data/corpus/README.md` and `posi-engine/scripts/run-pjr-seed-pipeline.mjs`'s
own header for what this pipeline does and does not establish (these are
`status: "discovered"` benchmark journals, never reviewed for POSI Core
Collection admission).

## What worked — identity resolution + minting (real, complete)

- **1000/1000 corpus journals resolved** to a candidate identity, 0 hard
  conflicts, 0 possible-duplicate groups (see `migration-audit.md`).
- **1000 real `POSI-J-######` ids minted** against
  `registry/journal-id-map.csv`, written to
  `journals/discovered/global-benchmark-seed-2025.jsonl` — real titles,
  publishers, ISSNs, OpenAlex Source ids, and PSC classification +
  4-state confidence (`psc_confidence`, PSC-CROSSWALK-0.2). Validated
  against `schema/journal.schema.json` (`posi-engine/scripts/validate-against-schema.mjs`
  — all 1000 records pass).
- This part of the pipeline needs only OpenAlex's `/sources/{id}` singleton
  lookup, which succeeded for all 1000 journals (see below).

## What did NOT work — PCI/PCI-5/PNCI metrics (blocked by an external API change)

**Every one of the 2000 `/works` filtered-list requests this run made
(1000 journals × {citable-item count, works page}) failed with HTTP 429.**
Direct confirmation (re-run outside the cache):

```json
{
  "error": "Rate limit exceeded",
  "message": "Insufficient budget. This request costs $0.0001 but you only have $0 remaining. Resets at midnight UTC. Need more? Add funds at https://openalex.org/pricing",
  "dailyRemainingUsd": 0,
  "prepaidRemainingUsd": 0
}
```

**OpenAlex now meters the `/works` filtered-list endpoint** (the one
`fetch-pjr-source-data.mjs` uses for both the exact 2-year citable-item
count and the 5-year works fetch that PCI/PCI-5's numerator/denominator
depend on) **separately from the free `/sources/{id}` singleton lookup**
this project's identity/PSC enrichment already relies on. The polite-pool
`mailto` tier that used to cover both now only covers the singleton
endpoint — the filtered list/search endpoints require a paid API key or
prepaid credits, and this run had zero of either configured.

This is **not a bug in this project's code** — `fetch-pjr-source-data.mjs`
correctly fetched everything the free tier still allows (all 1000 source
records, 100% success), and a separate, real bug in how the exhausted-retry
case discarded the actual 429 body (fixed in the same commit as this run —
see posi-engine's `b39cc13`) was found and fixed while diagnosing this.
But it **is a real, structural blocker** for computing PCI/PCI-5/PNCI —
`schema/metric.schema.json`'s citable-items denominator cannot be computed
at all without this endpoint. **This affects every future PJR release
pipeline run, not just this seed corpus** — flagged here prominently for
the platform owner, since it changes the cost/architecture of POSI's core
citation-metrics ETL going forward (either a paid OpenAlex plan, or a
different data source/strategy for the works-list step specifically).

Every metric snapshot in `sample-output/` reflects this honestly:
`status: "insufficient_data"` (not a fabricated ratio, not silently
skipped) for all 1000 journals, `citable_items: 0`, `pci: null`. Ranking:
0 categories reached `MIN_CATEGORY_SIZE` (nothing to rank without PCI
values). See `pipeline-summary.json` for the exact counts.

## Reproducing / completing this once OpenAlex access is resolved

`fetch-pjr-source-data.mjs`'s cache
(`pjr-cache/`, not committed here — it lived in the session's local
scratchpad) is disk-keyed by request signature; once a paid OpenAlex key
or the free-tier budget is available again, re-running the exact same
`fetch-pjr-source-data.mjs` command will skip every already-cached
`source_*` request (still valid, nothing re-fetched) and retry every
`works_*`/`count_*` request that recorded a 429 (those weren't cached as
permanent failures — only 200/404 responses are cached long-term by
design). Then re-run `run-pjr-seed-pipeline.mjs` with the same
`--posi-data-dir` — it will reuse every already-minted `POSI-J-######` id
(never re-mints) and simply fill in real PCI/PCI-5/PNCI values where the
data now exists.
