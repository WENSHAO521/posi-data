# ISSN integrity review queue

`open-issues.csv` lists ISSN problems in `journals/` that are waiting for a person to decide. posi-engine's
validator (`scripts/validate-against-schema.mjs`) checks every journal record for:

- an ISSN whose check digit is wrong (`checksum`);
- an ISSN held by two live POSI-J ids (`shared`); an id listed in `registry/superseded-ids.csv` is not live.

A finding listed here is reported as a warning. A finding that is not listed fails validation, so a new bad ISSN
or a new duplicate identity cannot be published unnoticed.

Nothing in this folder changes a record. To close an issue: correct the record (or supersede the duplicate id in
`registry/superseded-ids.csv`) with the evidence in the commit message, then delete the row here. A row whose
problem is gone is harmless but should be removed.

Columns: `kind`, `issn`, `posi_ids` (space-separated), `evidence`, `suggested_action`.

First run, 2026-10-11, over 28,518 records: 4 check-digit failures (the same four the initial migration logged
in `audits/migrations/initial-journal-migration/invalid-identifiers.csv`) and 5 ISSNs on two live ids. Four of
those five are the same journal minted twice. The fifth, `2813-5067`, is two different journals: Frontiers in
Environmental Science carries Frontiers in Environmental Engineering's ISSN and website. Its POSI-J id is keyed
on its own ISSN-L (`2296-665X`), so only the record's attributes are wrong, not its identity.
