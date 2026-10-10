# Wiley Crossref expansion — 2026-10-10

Adds Wiley journals found in Crossref (member 311) that had no record in
posi-data, and registers their identities.

## Source

Journals were found from the member's journal articles published from 2018-01-01
to 2026-10-10: the ISSN facet of `/members/311/works`, read in date windows that
were split until each fit under the facet's 1,000-value cap, then looked up at
`/journals/<issn>` to merge a journal's print and online ISSN. Journals with no
article since 2018 are not covered. The DOAJ flag comes from a DOAJ search by ISSN
on the same date. [`crossref-member-311-candidates.json`](./crossref-member-311-candidates.json)
is that snapshot (1,659 journals).

## Result

```
candidates (Crossref, member 311):        1659
  already in registry (by any ISSN):       106   -> not touched, listed in already-in-registry.json
  new:                                    1553
registry rows:                          26388 -> 27941  (+1553 minted, issn_pair tier)
journals/discovered/wiley-expansion-2026.jsonl:  1553 records
```

Validated with `posi-engine/scripts/validate-against-schema.mjs`: all valid.

## Choices

- Identity tier is `issn_pair` (sorted ISSNs joined by `/`; a single ISSN is a one-element pair). Crossref gives no ISSN-L, so
  `identifiers.issn_l` is `null`, as in `publisher-expansion-canonical-records-2026`.
- An ISSN already in the registry, as an ISSN-L or as part of a pair, counts as a match even when the other ISSN differs; such a journal gets no new id.
- `publisher` is Crossref's own name for the journal (`Wiley (John Wiley & Sons)`, `Wiley (Blackwell Publishing)`, `Hindawi Limited`, ...). 59 journals Wiley hosts for societies keep their own publisher name and no `website_url`.
- `open_access` is true only for the 5 journals found in DOAJ; the rest are subscription journals (`false`). `license`, `country`, `language`, `classification` are `null`: Crossref does not supply them.
- Journals with the same ISSN under a new publisher are not renamed here; this run only adds.

## Correction: duplicate ISSNs in the first run's registry rows

Crossref lists a journal's ISSN twice when its print and online ISSN are the same, and the first run built the
`issn_pair` value from that list, so 177 of the 1,553 new rows had values such as `2637-3726/2637-3726` or
`1344-3941/1344-3941/1740-0929`. `registry/README.md` counts identical ISSNs as one. The `identity_value` of those
177 rows was corrected (ids unchanged, none had been used by anything else yet); the list is in
[`registry-identity-value-fixes.json`](./registry-identity-value-fixes.json), and the script now de-duplicates the ISSN set.

## Reproducibility

```
node posi-data/scripts/ingest-crossref-publisher.mjs \
  --candidates posi-data/audits/migrations/wiley-crossref-expansion-2026/crossref-member-311-candidates.json \
  --member 311 --retrieved 2026-10-10 --out wiley-expansion-2026 \
  --audit-dir posi-data/audits/migrations/wiley-crossref-expansion-2026 \
  --site 'https://onlinelibrary.wiley.com/journal/{issn}' --match wiley
```

Run from the directory that holds both `posi-data` and `posi-engine`. A second run finds every ISSN in the registry and writes nothing.

## Files

- [`new-journals-mapping.csv`](./new-journals-mapping.csv) — the 1,553 new records and their ids.
- [`already-in-registry.json`](./already-in-registry.json) — the 106 candidates that already had an id.
- [`manifest.json`](./manifest.json) — counts.
