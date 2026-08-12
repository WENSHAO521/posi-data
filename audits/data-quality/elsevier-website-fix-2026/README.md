# Elsevier Website URL Fix 2026

Cross-references [`jnlactive.csv`](../../../source-lists/jnlactive.csv) (Elsevier's own
active-journals export — ISSN, product ID, current ScienceDirect
"Shortcut URL" — uploaded directly to `master` on 2026-08-12) against the
316 Global Benchmark Collection records whose `publisher` field matches
"Elsevier BV", to fix stale `website_url` values before this corpus is
crawled for real (Evidence ETL v1's Core Collection run didn't touch any
Elsevier-published journal; this matters once Evidence ETL scales to the
1000-journal Global Benchmark set).

## Result

```
Elsevier-published records in Global Benchmark:  316
Matched to jnlactive.csv by ISSN:                305
  -> already correct, unchanged:                   0
  -> stale, fixed:                               305
Could not match by ISSN (left untouched):         11
```

**Every single matched record's `website_url` was stale.** None needed no
change. Breakdown of what the old URLs looked like:

```
journals.elsevier.com/...                          194
elsevier.com/wps/find/journaldescription.cws_home/...  49  (a defunct
                                                             Elsevier CMS
                                                             URL structure)
sciencedirect.com/science/journal/... (wrong ISSN path)  41
elsevier.com/locate/...                              18
other                                                  3
```

All 305 replaced with `https://www.sciencedirect.com/science/journal/
{unformatted_issn}` — the exact URL Elsevier's own current export lists
for that ISSN. See
[website-url-changes.csv](./website-url-changes.csv) for the full
per-record change log (old URL, new URL, ISSN).

## The 11 that did not match — left untouched, not guessed

```
The Lancet
Nuclear Instruments and Methods in Physics Research Section A ...
Journal of environmental chemical engineering
Oncology Reports
Biochimie
Transportation research procedia
International Journal of Gynecology & Obstetrics
Cochrane Database of Systematic Reviews
Transplantation and Cellular Therapy
Bone
European Journal of Obstetrics & Gynecology and Reproductive Biology
```

These are worth a closer look, not a mechanical retry — at least two
(`Cochrane Database of Systematic Reviews`, `International Journal of
Gynecology & Obstetrics`) are, in reality, **Wiley-published, not
Elsevier** (Cochrane Library is a Wiley/Cochrane Collaboration
publication; IJGO is FIGO's journal, published by Wiley) — suggesting
this benchmark corpus's `publisher` field is itself wrong for at least
some of these 11, not just the `website_url`. See
[unmatched-needs-review.json](./unmatched-needs-review.json) for the full
list with current ISSN/URL. **Not fixed in this PR** — this needs a
person to check the actual current publisher/ISSN for each of the 11,
not an automated guess; flagging it here rather than silently leaving it
undiscovered.

## What this PR does NOT do

- Does not touch any non-Elsevier record.
- Does not touch `corpus/core-collection.json` (0 Elsevier-published
  journals there).
- Does not attempt to fix the 11 unmatched records — see above.
- Does not re-crawl or re-run Evidence ETL against the corrected URLs —
  that's the natural next step once this merges, but is separate,
  larger-scope work (the actual Global Benchmark Evidence ETL run).
