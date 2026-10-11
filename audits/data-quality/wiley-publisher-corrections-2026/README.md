# Wiley publisher corrections — 2026-10-10

31 values corrected in the canonical records, to match the website repository's correction of the same journals
(wenshao521/panorama-open-scholarly-index#83). Found by checking the 283 Wiley records of the website's
Discovered file against Crossref (`/journals/<issn>`).

- **30 publishers:** the journal's Crossref publisher is no longer Wiley and its website is not Wiley's. The new value is
  Crossref's own publisher name.
- **1 title:** POSI-J-016613 `Neuroprotection/Neuroprotection (Chichester, England. Print)` is `Neuroprotection`.

`changes.csv` lists each change with the file it is in. Files touched: `journals/discovered/initial-journal-migration-2026.jsonl`,
`journals/core/09/POSI-J-000653.json` and the same record in `corpus/global-benchmark.json`. Ids, ISSNs and the registry are unchanged.

Not changed: Wiley-hosted society journals (agupubs., efsa., londmathsoc. subsites) and Hindawi, whose site is Wiley's;
and nine records whose second ISSN Crossref does not know (Aggregate, Carbon Energy, InfoMat, Animal Models and Experimental
Medicine, SusMat, Interdisciplinary medicine, Smart Medicine, Medicine Advances, Responsive materials), which need a check
against the ISSN Portal because an ISSN change touches the registry.

## Corrections after review

Codex's review of posi-data#53 (after the merge) led to these changes in the same records:

- `country` of the 30 publisher-corrected records is `null`: it described the publisher the record had before (the schema defines it as
  the publisher's registered country), and Crossref does not give the new one.
- POSI-J-001448 (dialectica): `publisher` is `null`. Verein philosophie.ch, Crossref's publisher, says on its own page that it published the
  journal only from 2020 to 2024 and that the journal now operates independently.
- POSI-J-016613 (Neuroprotection): `title` is the ISSN Portal key title `Neuroprotection (Chichester, England. Print)` and `short_title` is
  `Neuroprotection`. The key title could not be re-read from the portal in this environment; it is taken from the second half of the original
  concatenated title.
- A `crossref` entry (retrieved 2026-10-10) is added to the `provenance` of the 31 records, and their `updated_at` (and the benchmark copy's) is advanced.
