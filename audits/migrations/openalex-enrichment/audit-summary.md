# OpenAlex Enrichment Audit v0.2 — Summary

Enrichment pass over the 23,819 candidate entities from
[Initial Journal Migration Audit v0.1](../initial-journal-migration/), keyed
on each candidate's valid ISSN(s), via OpenAlex's singleton source lookup
(`GET /sources/issn:{issn}` — not the search/filter endpoint). This is
**identity evidence, not a merge**: no candidate entity was combined with
another, no `POSI-J-######` id was assigned, and no citation-impact field
(2yr mean citedness, works count used for ranking, etc.) was pulled in this
pass — only identity/metadata fields (`id`, `issn_l`, `issn`, `display_name`,
`type`, `host_organization_name`, `homepage_url`, `is_oa`, `is_in_doaj`,
`works_count`).

## Per-candidate status breakdown

| Status | Count | Meaning |
|---|--:|---|
| `verified` | 23,674 | Every ISSN on the candidate resolved to the same single OpenAlex source, and that source's `type` is `journal`. |
| `not_found` | 45 | None of the candidate's ISSNs resolved to any OpenAlex source (all lookups 404). |
| `partial_match` | 5 | Some but not all of the candidate's ISSNs resolved, and the ones that did agree on a single `journal`-type source. |
| `source_type_conflict` | 17 | An ISSN resolved to an OpenAlex source, but that source's `type` is not `journal` (e.g. `conference`, `book series`, `repository`). Flagged for review, not auto-corrected. |
| `multiple_sources` | 1 | Two different ISSNs on the same candidate resolved to two *different* OpenAlex source ids — "conflict beats match": the pipeline treats this as unresolved evidence, not evidence for or against anything, and does not pick one. |
| `review_required` | 77 | A lookup failed after retries (network error / non-404 HTTP failure), not a data conflict. These need a re-run, not human judgment, once transient failures clear. |

23,819 candidates in, 23,819 rows out — every candidate got exactly one
classification.

## Possible-duplicate rescoring

The 171 `possible_duplicate` groups flagged in v0.1 (title+publisher match,
ISSNs did **not** overlap, never auto-merged) were re-scored using this
enrichment evidence:

| Rescoring outcome | Count | Meaning |
|---|--:|---|
| `openalex_confirms_same` | 164 | Both entities' ISSNs independently resolved to the *same* OpenAlex source id (or the same `issn_l`) — strong identity evidence they are one journal under two ISSNs. Still not auto-merged; scored as strong-evidence-for-merge for the human review step. |
| `openalex_confirms_distinct` | 5 | Both entities' ISSNs resolved to OpenAlex sources with different, unrelated `issn_l` values — evidence they are genuinely two different journals despite the title/publisher similarity. |
| `manual_review` | 2 | OpenAlex evidence was inconclusive or itself conflicting (e.g. one side `not_found`, or a `multiple_sources`/`source_type_conflict` status on either entity) — no automatic verdict possible either way. |

Full row-level detail: [`rescored-possible-duplicates.csv`](rescored-possible-duplicates.csv).

## What this audit does *not* do

- **No merging.** `openalex_confirms_same` is scored evidence for a future
  human-reviewed merge step, not an executed merge. Candidate entity counts
  are unchanged from v0.1 (still 23,819).
- **No POSI-J id assignment.** Identity minting only happens after the
  merge/curation step this audit feeds into.
- **No citation-impact data.** `works_count` is pulled (it's a size/coverage
  signal used to sanity-check `source_type_conflict` cases), but PCI-
  relevant fields (`2yr_mean_citedness`, `h_index`, `cited_by_count`) are
  explicitly out of scope for this pass — see `PJR-SPEC.md` for where those
  belong.
