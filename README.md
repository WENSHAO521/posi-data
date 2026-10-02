# posi-data

Canonical, versioned data and methodology of **POSI (Panorama Open Scholarly
Index)**: journal records and identities, subject classification, lifecycle
ratings, citation indicators, rankings, and the specifications that define
them. This repository, not a database server, is the source of truth: every
number POSI publishes traces back to a commit here.

## POSI Journal Evaluation Architecture 1.0

POSI evaluates journals in five separate layers
([POSI-EVAL-1.0-SPEC.md](./POSI-EVAL-1.0-SPEC.md)):

| Layer | Question | Output |
|---|---|---|
| **PQF** | Can the journal enter or remain in the Core Collection? | Score 0–100: Eligible (≥ 70), Review Required, Insufficient Evidence, Not Eligible (< 40) |
| **AJR** | How strong is its lifecycle development? | Observation (0–11 months), AJR-E (12–59), AJR-M (60+): AJR Score + AJR Rating A+ … D |
| **PCI / PNCI / PCS** | What does citation evidence show? | PCI (OpenAlex), [PNCI](./PNCI-1.0-SPEC.md) (normalized by field, year and type), PCS (Crossref, supplementary) |
| **Citation Ranking** | Where does it rank in its PSC category? | Rank, mid-rank percentile, Citation Quartile Q1–Q4 (shown as C-Q1–C-Q4), from PNCI only |
| **POSI Zones** | POSI's selective grouping | Zone 1 (≥ 95th percentile), Zone 2 (≥ 80), Zone 3 (≥ 50), Zone 4 |

PQF is not a ranking, AJR is not a quartile, and PCS determines no rank,
quartile or zone. E-Q / M-Q, PCS-Q and the PCI-based Citation Q are retired
and kept only as archive.

## Layout

| Path | Contents |
|---|---|
| `corpus/` | `core-collection.json` (31 certified journals) and `global-benchmark.json` (4,289 external reference journals), with PQF and AJR (`early_stage_rating.rating`) |
| `journals/` | Canonical and discovered journal records, sharded |
| `registry/` | Permanent `POSI-J-######` identity map, superseded ids, excluded identities |
| `taxonomy/psc/` | POSI Subject Classification |
| `rankings/citation/` | Citation Ranking editions (PNCI-1.0, CITATION-RANK-1.0), imported from posi-engine |
| `rankings/pcs-q/` | PCS editions (PCS values; their PCS-Q quartiles are retired) |
| `evidence/` | Evidence Coverage snapshots used by AJR |
| `schema/` | JSON Schemas: journal, metric, rating, citation-ranking, evaluation, ranking (deprecated) |
| `releases/` | POSI-R release manifests |
| `audits/` | One directory per migration, ingestion or rating run, with its data and reasoning |
| `source-lists/` | Unmodified publisher title lists used for ingestion |
| `scripts/` | `publish-data-snapshot.mjs`, `migrate-evaluation-1.0.mjs`, `extract-apc.mjs` |

## Specifications

| Spec | Scope |
|---|---|
| [POSI-EVAL-1.0](./POSI-EVAL-1.0-SPEC.md) | Evaluation architecture: ranking method, percentiles, quartiles, zones, minimum data, ties, snapshots, versioning, limitations |
| [PNCI-1.0](./PNCI-1.0-SPEC.md) | PNCI formula, items, baselines |
| [AJR](./AJR-SPEC.md), [AJR-E-1.1](./AJR-E-1.1-SPEC.md), [AJR-M-1.1](./AJR-M-1.0-SPEC.md) | Lifecycle rating models |
| [PJR](./PJR-SPEC.md) | PCI / PCI-5 and PJR releases |
| [PCS-1.0](./PCS-1.0-SPEC.md) | PCS |
| [PSC-CROSSWALK](./PSC-CROSSWALK.md) | Subject classification |
| [GLOBAL-INDEX-1.0](./GLOBAL-INDEX-1.0-SPEC.md) | The global journal index cycle |
| [POSI-R-1.0](./POSI-R-1.0-SPEC.md) | Platform releases |
| [PCS-Q-1.0](./PCS-Q-1.0-SPEC.md), [POSI-ZONES-1.0](./POSI-ZONES-1.0-SPEC.md), [EARLY-STAGE-RATING](./EARLY-STAGE-RATING-SPEC.md) | Superseded, kept for the record |

Every change to a formula, threshold or status is a version bump recorded in
[CHANGELOG.md](./CHANGELOG.md).

## Data flow

```
posi-engine global-index (yearly, December) ──release──▶ import-global-index (every 20 min) ──▶ rankings/ in this repo
posi-engine ajr-rerate (monthly, 7th) ──pull request──▶ corpus/, evidence/ in this repo
this repo ──publish-data-snapshot.mjs──▶ posi-data-delivery ──▶ data.posi.panorama-sg.com ──▶ website
```

- `.github/workflows/import-global-index.yml` imports the newest complete
  engine release: the Citation Ranking edition into `rankings/citation/`, the
  PCS edition into `rankings/pcs-q/`, summaries into `audits/global-index/`.
  The ranking is built once a year; posi-engine's monthly journal-directory
  releases feed the website's journal directory, not this repository.
- posi-engine's monthly AJR rerate refreshes the Core Collection's evidence
  (`evidence/`) and ratings (`early_stage_rating`, `mature_rating` in
  `corpus/core-collection.json`) and opens a pull request here, branch
  `ajr-rerate/<YYYY-MM>`; nothing changes until it is reviewed and merged.
- posi-data-delivery builds an immutable snapshot whenever the published
  collections change.
- `.github/workflows/validate.yml` validates records against `schema/` on
  every push and pull request.

## Releases

A POSI-R release (`POSI-R-{year}.{revision}`) is a reviewed manifest in
`releases/` recording the SHA-256 of every collection it contains. Current:
[POSI-R-2026.1](./releases/POSI-R-2026.1/manifest.json). Official releases are
cut once a year in December; between releases, data is published as
post-release snapshots.

## Principles

1. **Open data and methodology**: every record, formula and threshold is here.
2. **Reproducible**: a release pins its data and engine commits.
3. **Provenance**: third-party data keeps its source and licence.
4. **Nothing silently lost**: ids are never reassigned, superseded ids resolve
   to their survivors, and migrations add rather than delete; legacy fields are
   kept and marked deprecated.
5. **Never claim more than was computed**: missing values stay missing, and
   diagnostic previews are never shown as rankings.

## Related repositories

- [posi-engine](https://github.com/WENSHAO521/posi-engine): computes the data here
- [posi-data-delivery](https://github.com/WENSHAO521/posi-data-delivery): public read layer
- [Panorama-Open-Scholarly-Index](https://github.com/WENSHAO521/Panorama-Open-Scholarly-Index): the website

## License

POSI-produced data (`schema/`, `taxonomy/`, `corpus/`, `rankings/`,
`releases/` and the rest): [CC BY 4.0](./LICENSE-DATA). Records aggregated
from upstream sources keep their origin's licence and attribution.
