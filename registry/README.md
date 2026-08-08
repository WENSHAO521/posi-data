# Journal ID registry

`journal-id-map.csv` is the permanent mapping from a stable external identity
(ISSN-L first, falling back down the chain below) to a `POSI-J-######` id.

**This file is append-only.** A `POSI-J-######` id, once assigned, is never
reassigned to a different journal and never reused after a journal is
removed. Migration/ingestion scripts must look up an incoming record's
identity here before minting a new id — never derive an id from array index
or row position in a source file (that breaks the moment the source file's
order changes).

## Columns

| Column | Meaning |
|---|---|
| `posi_id` | `POSI-J-######`, assigned once, permanent |
| `identity_type` | Which identity field resolved this journal — see priority order below |
| `identity_value` | The value of that field at assignment time |
| `first_seen` | ISO date this id was first minted |

## Identity resolution priority

When ingesting a journal record, resolve its identity in this order — the
first one that matches an existing registry row wins; if none match, mint a
new id using the highest-priority identity available on the incoming record:

1. ISSN-L
2. Canonical (print, online) ISSN pair
3. OpenAlex Source ID
4. Another stable upstream source id (Crossref member+title, DOAJ id, …)
5. Unresolved — flagged for manual identity review, not auto-assigned

## Before the first bulk migration

Per the migration plan, a **dry run** produces a Migration Audit Report
(duplicate groups, missing ISSN-L, title/publisher conflicts, unresolved
identities) *before* any `POSI-J-######` ids are minted or committed here.
This registry stays empty until that audit has been reviewed — see
`posi-engine`'s (forthcoming) migration scripts.
