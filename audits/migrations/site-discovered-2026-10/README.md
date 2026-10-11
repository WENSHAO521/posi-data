# Journals the website had and posi-data did not

The website's discovered directory (25,676 records) is being moved into
posi-data. Of its 348 journals that matched no ISSN here
(`audits/reconcile-site-discovered-2026-10-11/only-site.csv`):

| | Journals |
|---|---|
| ISSN already in the registry | 9 |
| New records and ids minted (`journals/discovered/site-discovered-2026-10.jsonl`, `registry/journal-id-map.csv` rows POSI-J-028141 on) | 234 |
| Held for review (same title as a record here, no ISSN in common) | 105 |

Produced with `scripts/ingest-crossref-publisher.mjs`; nothing held was minted.

## Held (`held-title-overlaps.csv`)

71 of the 105 have the **same OpenAlex source id** as the existing record. By
`registry/README.md` that is an identity match (priority 3), so they are most
likely the same journal under another ISSN and should be linked to the existing
POSI id, not given a new one. 33 have a different OpenAlex id (a relaunch or a
different journal with the same title) and 1 cannot be compared. A person
decides each; the linking of the 71 is done when the website's records are keyed
to POSI ids (the next step of Panorama-Open-Scholarly-Index
`docs/MIGRATION-PLAN.md`).
