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
