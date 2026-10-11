# Reconcile the website's discovered journals with posi-data

Read-only audit. No record in `journals/`, `corpus/` or `registry/` was changed.
Produced by `scripts/reconcile-site-discovered.mjs` from the website's
`src/lib/discovered-journals.json` (25,676 records, 2026-10-11) and this
repository's `journals/core` and `journals/discovered` (28,122 distinct ids).
Matching is by ISSN, as `registry/README.md` puts first.

Purpose: the website repository is to become front end only
(Panorama-Open-Scholarly-Index `docs/MIGRATION-PLAN.md`), so its 25,676 records
need one owner. Before any record moves, a person decides per list below
which side is right.

| File | Rows | What it is |
|---|---|---|
| `only-upstream.csv` | 3,103 | here, not on the site (2,064 `publisher-expansion-2026`, 169 `wiley-kbart-completion-2026`, 30 `initial-journal-migration-2026`, the rest core/benchmark) |
| `only-site.csv` | 348 | on the site, matching no ISSN here |
| `differences.csv` | 11,801 field differences over 25,251 matched journals | see below |
| `ambiguous.csv` | 77 | a site record whose ISSNs match more than one POSI id |
| `upstream-shared-issn.csv` | 63 | ISSNs carried by two or more POSI ids here |

## Differences by field

| Field | Rows | Reading |
|---|---|---|
| publisher | 9,271 | 7,768: empty here, the site has one (Crossref fill by the site's daily job); 1,413: same publisher, different spelling (e.g. `Wiley` / `Wiley (Blackwell Publishing)`); 89: different publishers; 1: empty on the site |
| title | 599 | mostly case, punctuation or a second-language title joined by `/` here |
| issn_print / issn_online | 803 / 509 | mostly a print ISSN present on the site and absent here |
| openalex_source_id | 498 | |
| open_access | 121 | site `null`, here `false`: 103, all in `journals/core` (the site records unknown rather than closed for journals DOAJ does not list, website #84); site `true`, here `false`: 18 |

## A defect found on the way

The website generated 32 journals' ids from an empty or truncated title slug,
so four ids were shared by 32 records (fixed in the website, ids are now
`issn-<ISSN>`). The initial migration here was made from that data: the ISSN
sharing in `upstream-shared-issn.csv` (e.g. ISSN 2227-7072 on 11 POSI ids,
POSI-J-000040 … 000483) and the "different publishers" rows (e.g. POSI-J-000178
*International Journal of Public Health*: here MDPI AG, correct Frontiers Media SA)
trace to it. **These upstream records carry another journal's publisher and ISSNs
and should be corrected from the site's records, not the other way round.**

## Decisions needed

1. `only-upstream.csv`: does the site show them (they are not in the site's
   directory today)?
2. `only-site.csv`: add to posi-data, or drop?
3. `differences.csv`: take the site's value for publisher where here is empty;
   normalise spelling; correct the contaminated records and the shared ISSNs from the site (`scripts/repair-from-site-reconcile.mjs` does the safe part; the remaining conflicts need a person).

## Applied

`scripts/repair-from-site-reconcile.mjs` was run on `journals/discovered`: 31
contaminated records repaired from the site, 7,439 empty publishers filled.
Every changed record carries a `posi_curation` provenance entry naming the site
record. `journals/core` and `corpus/` were not changed: the 103 `open_access`
false-versus-unknown cases live in both `journals/core` and
`corpus/global-benchmark.json`, so they need one coordinated change
(`--include-core` plus the corpus) and a new release hash. Publisher spelling
variants (1,413), the 89 remaining different publishers, titles and ISSN roles
are left for a person.
