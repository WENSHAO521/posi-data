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

## Corrections after review

Codex's review of the first run (posi-data#51, which arrived after the merge) found problems in the registry and the records;
the data below was corrected and `scripts/ingest-crossref-publisher.mjs` was changed so a new run cannot repeat them.

- **Four journals had two ids** because two candidates shared an ISSN and were both minted. The lesser record of each pair is
  superseded (`registry/superseded-ids.csv`, rows dated 2026-10-10) and removed from `wiley-expansion-2026.jsonl`:
  POSI-J-026434 -> 026437 (Hastings Center Report), 027287 -> 027288 (TESOL Journal), 027419 -> 027420 (its title was an article
  title; ISSN 2050-0394 is the online ISSN of Review of European Comparative & International Environmental Law),
  027501 -> 027508 (same ISSN 1552-3934). The registry rows of the old ids stay.
- **Nine records carried an ISSN with a wrong check digit** (Crossref repeats typos such as 1345-5078 for 1354-5078, and the
  placeholder 1234-5678 on POSI-J-027600). The wrong value is replaced by the valid ISSN from the same Crossref list (e.g.
  1354-5078), and the `issn_pair` value of those nine registry rows keeps only valid ISSNs. The ids are unchanged and nothing else
  used them yet. Changes: POSI-J-026644, 026695, 026753, 026756, 026926, 027129, 027203, 027533, 027600.
  Four more registry rows held an invalid ISSN only among their extra pair values (not in the record's print or online field), and
  were corrected the same way: POSI-J-026643 (1521-3979), 026895 (1752-0117), 026996 (1034-3780), 027506 (1467-8441).
  The candidate snapshot now carries the DOAJ journal ids (it had `true`), so the documented command reproduces the `doaj_id` values.
- **`open_access` is true for the 5 DOAJ-listed journals (now with their `doaj_id`) and `null` for the rest.** The first run wrote
  `false` for every journal DOAJ does not list, which says more than is known: Food Science & Nutrition, for one, is open access.
  The DOAJ lookup was re-run with retries and no failed batch; the count of 5 is unchanged.
- **Kept after review:** POSI-J-026765 and POSI-J-027770 (both `Canadian Geographies / Géographies canadiennes`) have no ISSN in
  common (0008-3658/1541-0064 and 3069-0587/3069-0595), which fits a relaunch under new ISSNs; two ids follow the registry's rule that
  the ISSN, not the title, is the identity. `Angewandte Chemie` (0044-8249, 1433-7851) is two registry journals, the German and the
  International Edition, that Crossref lists under one title; nothing was minted for it and it stays under POSI-J-023339.
- **Script:** candidates are de-duplicated and check-digit-validated, merged when they share an ISSN, held for review when ISSNs
  conflict or a title repeats without a shared ISSN (`review.json`), follow `superseded-ids.csv`, and the registry and the records are
  written to temporary files and renamed together. Run against the same candidates and the registry as it was before #51 it mints
  1,547 ids (the 1,553 minus the four merged pairs and the two held titles) and re-running it on the current data changes nothing.

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
