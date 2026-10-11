# Wiley KBART completion — 2026-10-11

Completes posi-data's Wiley journals against Wiley's own list of the journals it carries, which replaces the earlier Crossref-based
estimate of what was missing.

## Source

Wiley's KBART list of its Large Journal Collections, full collection for 2027, file dated 2026-10-01
([`source-lists/wiley-kbart-fullcollection-2027-2026-10-01.txt`](../../../source-lists/wiley-kbart-fullcollection-2027-2026-10-01.txt),
unmodified): 1,521 serials, publisher `Wiley`, access type P (1,519) or F (2), every ISSN with a valid check digit; 191 have a last-issue date.
The same list split into Wiley's three subject files (named M&N, SSH and STM; 431, 548 and 973 rows) was
also checked: together they hold 2,913 ISSNs, exactly those of the full collection, so they add no journal and nothing was ingested from them.
The 3,397 "publications" on Wiley's site count more than journals; this file is the journal list.
It is the subscription collections: Wiley's open access journals (for example Carbon Energy, Brain and Behavior) are not in it.

## Result

```
KBART journals:                              1521
  already in the registry (by any ISSN):     1338   (before this run)
  not in the registry:                        183
    new ids minted:                           182   (registry 27,958 -> 28,140 rows)
    already registered the day before:          1   (Tissue Antigens, POSI-J-027956, from the monthly sync)
After this run: all 1,521 are in the registry.
```

The 183 were not found earlier because the Crossref scan looked at member 311 and articles from 2018 on:

- **138 have ended** (a last-issue date, 1996 to 2023; 136 of them before 2018, which is why a scan of articles from 2018 on could not see them). They are recorded with
  `status_model.collection_status: "ceased"` and `coverage_state: "inactive"`; Tissue Antigens (ended 2015) was marked the same way.
- **45 are current** but belong to other publishers that use Wiley's platform, and are registered in Crossref under their own member:
  ASME International 27, International Union of Crystallography 6, Cambridge University Press 1, Stichting Nase 1, and 10 shown as Wiley
  (9 in Crossref and 1 not in Crossref at all) whose articles the member 311 scan did not return.

## Choices

- `publisher` is Crossref's name for the journal where Crossref knows it (ASME International, International Union of Crystallography, ...),
  else `Wiley`. `website_url` is the KBART `title_url` (the journal's page on Wiley Online Library).
- Titles are the KBART titles (the title carried on the platform for that ISSN, which for ended journals is the old title).
- `open_access` is `null` (unknown): the list is of subscription collections, but that does not show a journal is closed, and none of the
  183 is in DOAJ (looked up with retries, no failed batch).
- Provenance: `publisher_direct` (the KBART `title_id`) and, where Crossref was consulted, `crossref`. `crossref_member_id` is empty:
  these were not found through a Crossref member.
- The first and last issue years are in `kbart-candidates.json` (`coverage_years`); the schema has no field for them.
- Run with `scripts/ingest-crossref-publisher.mjs`, which gained two optional candidate fields (`provenance`, `website_url`, `ceased`).

## Left for a decision

- **Resolved: `Sculpture Review` (POSI-J-027883) and `Sculpture, Monuments and Open Space` (POSI-J-027684) are one journal.** The KBART list shows
  the second as the 2024 successor of the first (`preceding_publication_title_id` 2632-3494), with the same print ISSN 0747-5284 and a new
  online ISSN 2993-3439; Crossref omitted the second's print ISSN, so the registry held two ids with no ISSN in common. By the registry's ISSN rule
  they are one journal: POSI-J-027684 is superseded by POSI-J-027883 (`registry/superseded-ids.csv`, 2026-10-11), its record is removed, and the
  survivor keeps its title and lists the later title as an alternate title. The registry row of the old id stays, so ISSN 2993-3439 resolves to the survivor.
- **724 Wiley or Hindawi records in posi-data are not in this list** (395 open access, 329 with unknown open access): open access titles
  (separate lists), Hindawi titles, and journals that have left the Wiley platform. Not checked further.
- The 9 records with an ISSN that Crossref does not know (Aggregate, Carbon Energy, InfoMat, Animal Models and Experimental Medicine, SusMat,
  Interdisciplinary medicine, Smart Medicine, Medicine Advances, Responsive materials) are all open access titles, so this list does not settle them.

## Files

- [`kbart-candidates.json`](./kbart-candidates.json) — the 183 candidates (KBART row plus Crossref publisher and article count).
- [`new-journals-mapping.csv`](./new-journals-mapping.csv), [`already-in-registry.json`](./already-in-registry.json), [`manifest.json`](./manifest.json), [`review.json`](./review.json) — the ingest output (nothing was held, merged, quarantined or in conflict).
