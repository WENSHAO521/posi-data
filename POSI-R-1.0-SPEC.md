# POSI-R 1.0 — Platform Release Specification

> **POSI-EVAL-1.0 (2026-09-28) — read this first.** From 2026-09-28 a POSI-R manifest also pins `evaluation_version` (POSI-EVAL-1.0), `citation_rank_version` (CITATION-RANK-1.0), `pnci_version` (PNCI-1.0) and `zones_version` (POSI-ZONES-2.0). `rank_version` RANK-1.0 names the archived E-Q/M-Q/Citation Q/PCS-Q tracks, all retired as published rankings.

> **Status: in force.** The first release, **POSI-R-2026.1**, was
> published on 2026-09-27; its manifest is
> [`releases/POSI-R-2026.1/manifest.json`](./releases/POSI-R-2026.1/manifest.json).
> Part of the **"POSI Journal Evaluation & Ranking Framework 1.0"**
> methodology overhaul.

## 1. What POSI-R is, and how it relates to PJR

**PJR** (`PJR-{year}.{revision}`, see PJR-SPEC.md) is scoped specifically
to citation data: PSC classification, PCI/PCI-5/PNCI, and Citation Q
rankings. It predates, and remains narrower than, the full lifecycle-
rating platform this framework adds (AJR-E, AJR-M, E-Q, M-Q, Evidence
Coverage, PQF, PCS, MQS/IRS/CVI).

**POSI-R** (`POSI-R-{year}.{revision}`) is a new, broader **platform
release** — a frozen snapshot of everything the website reads, not only
the citation subset. A POSI-R release references the PJR release it
bundles (if any citation data is ready — see § 4's `pjr_release` field);
it does not replace or duplicate PJR's own manifest. **PJR-SPEC.md is not
superseded or amended by this document** — a citation-only reproducibility
citation ("PJR Journal Reports 2028, PCI 2027 = 3.42") still resolves
against a PJR release exactly as before.

Think of it as: **POSI-R is the release a reader cites when referring to
"the platform's Nth annual release"; PJR is the release a reader cites
when referring specifically to citation numbers.** A POSI-R release can
ship with `pjr_release: null` (lifecycle ratings shipped, citation
component still `Pending`, see § 6) — this is expected, not an error
state, during any period where OpenAlex access is degraded.

## 2. Release naming

`POSI-R-{publication_year}.{revision}`, e.g. `POSI-R-2026.1`. The
publication year is the calendar year the release ships in (not
necessarily `metric_year + 1` the way PJR's naming works, since POSI-R
covers rating data that isn't citation-year-scoped the same way PCI is).
A `.2`, `.3`, … revision is used only for a corrected re-issue of the same
release, mirroring PJR-SPEC.md § 7's rule.

## 3. Component versions bundled into a POSI-R release

Every POSI-R manifest pins the exact version of each independently-
versioned component that contributed to it (PJR-SPEC.md § 11's
"independent version strings" principle, extended platform-wide):

| Component | Version string field | Spec |
|---|---|---|
| Lifecycle boundary rules | `lifecycle_version` | LIFECYCLE-1.1 |
| PSC classification | `psc_crosswalk_version` | PSC-CROSSWALK-0.2 |
| AJR-E | `ajr_e_version` | AJR-E-1.1-SPEC.md |
| AJR-M | `ajr_m_version` | AJR-M-1.0-SPEC.md |
| E-Q / M-Q / Citation Q ranking core | `rank_version` | RANK-1.0 |
| Evidence Coverage | `evidence_version` | EVIDENCE-1.0 (AJR-SPEC.md § 6) |
| MQS / IRS / CVI diagnostics | `diagnostics_version` | DIAG-1.0 |
| PCS | `pcs_version` | PCS-1.0-SPEC.md |
| PCI / PCI-5 / PNCI | `pci_version` | `Pending` until OpenAlex-sourced data is available; `PCI-1.0` once shipped (PJR-SPEC.md § 6) |
| PJR (citation-only release, if bundled) | `pjr_release` | `null` until a matching PJR release exists |

A component whose data isn't ready yet (most likely `pci_version` /
`pjr_release`, per § 6) still gets an explicit value — `"Pending"` /
`null` — never an omitted field. A reader inspecting a POSI-R manifest
should never have to guess whether a missing field means "not applicable"
or "not ready yet."

## 4. Manifest format

```json
{
  "release": "POSI-R-2026.1",
  "published": "2026-08-31",
  "data_cutoff": "2026-08-29",
  "lifecycle_version": "LIFECYCLE-1.1",
  "psc_crosswalk_version": "PSC-CROSSWALK-0.2",
  "ajr_e_version": "AJR-E-1.1",
  "ajr_m_version": "AJR-M-1.0",
  "rank_version": "RANK-1.0",
  "evidence_version": "EVIDENCE-1.0",
  "diagnostics_version": "DIAG-1.0",
  "pcs_version": "PCS-1.0",
  "pci_version": "Pending",
  "pjr_release": null,
  "data_commit": "<git sha of posi-data at generation time>",
  "engine_commit": "<git sha of posi-engine used to generate this release>",
  "journal_count": 24205,
  "core_collection_count": null,
  "early_stage_rated_count": null,
  "mature_rated_count": null,
  "supersedes": null
}
```

A manifest may carry further version and count fields (for example
`pcs_q_version`) and must carry `files`: the SHA-256 of every collection
file the release contains, keyed by path. The public data layer publishes
a snapshot as the release only when its collections match `files`
exactly (see [`releases/README.md`](./releases/README.md)).

`supersedes` mirrors PJR-SPEC.md § 7 — set only for a corrected re-issue
of the same release, `null` for a normal release. The three `*_count`
fields left as `null` above are illustrative placeholders — a real
manifest fills every count field with an actual number at generation
time, per PJR-SPEC.md § 2's `buildManifest()` convention (which
`posi-engine/src/release.mjs` already implements for PJR manifests; a
POSI-R equivalent extends the same pattern rather than inventing a
different one).

## 5. Relationship to the platform's public status label

A POSI-R release existing and being current is the trigger for the
website switching its platform-wide status label from **Public Beta** to
**Official Operation** — but the two are not the same action. Cutting a
POSI-R release is a data/engine-side event (this repository +
posi-engine); flipping the website's status label is a separate,
explicit, human-triggered action on the website repository once the
release has been reviewed. Neither happens automatically as a side effect
of the other.

## 6. Partial releases are expected, not blocking

Per the framework's own principle: **a component being `Pending` does not
block the rest of a POSI-R release.** If OpenAlex access is unavailable at
data-cutoff time, a POSI-R release still ships with AJR-E, PSC, PCS, PQF,
MQS/IRS/CVI, and Coverage fully `Operational`, while `pci_version:
"Pending"`, `pjr_release: null`, and every AJR-M record shows
`Citation Performance: Pending Citation Data` (AJR-M-1.0-SPEC.md § 2's
"missing sub-metric shrinks `computable_max`, never scores 0" rule already
handles this at the per-journal level — this section is the release-level
analogue of that same principle: missing data narrows what's reported,
never blocks what's ready).

## 7. Changelog

**1.0** (this document) — first POSI-R spec. No prior platform-wide
release manifest convention existed; PJR-SPEC.md's manifest (citation-only
scope) predates this document and continues unchanged.
