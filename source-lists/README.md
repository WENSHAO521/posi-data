# Source Lists

Raw, unmodified journal-title exports from publishers/consortia, uploaded
directly to this repo as the input for a cross-check/ingestion pass against
`corpus/global-benchmark.json`. Kept verbatim (not hand-edited) so the
provenance of any downstream fix or new record can be traced back to the
exact file that was crawled/parsed.

| File | Source | Rows | Used by |
|---|---|---|---|
| `jnlactive.csv` | Elsevier's own active-journals export (Full Title, ISSN, Unformatted ISSN, Product ID, Change History, Shortcut URL) | 3433 | `audits/data-quality/elsevier-website-fix-2026/`, `audits/migrations/elsevier-jnlactive-expansion-2026/` |
| `frontiers-titlelist-web-2026.csv` | Frontiers Media title list distributed via the Swiss Academic Libraries consortium ("Last update: 23.02.2026/AKO"); an 11-line preamble precedes the real `Journal,ISSN,URL` header | 234 (204 with a non-empty ISSN) | `audits/migrations/frontiers-expansion-2026/` |
| `wiley-kbart-fullcollection-2027-2026-10-01.txt` | Wiley's KBART list of its Large Journal Collections, full collection for 2027, file dated 2026-10-01 (tab-separated) | 1521 serials | `audits/migrations/wiley-kbart-completion-2026/` |
| `wiley-kbart-mn-2027-2026-10-01.txt`, `wiley-kbart-ssh-2027-2026-10-01.txt`, `wiley-kbart-stm-2027-2026-10-01.txt` | The same list split by subject collection: Mathematics & Natural Sciences (431 rows), Social Sciences & Humanities (548), Science, Technology & Medicine (973). Together they hold exactly the ISSNs of the full collection; kept for reference, nothing was ingested from them separately | 1952 | reference only |

The two CSV files are not uniformly shaped — always parse them with
`posi-engine/src/showjcr/csv.mjs`'s `parseCsv()` (RFC4180-correct: handles
quoted fields containing commas, which `jnlactive.csv`'s titles do) rather
than a naive `split(',')`. The Wiley KBART files are tab-separated, with the
standard KBART header on the first line (`publication_title`, `print_identifier`,
`online_identifier`, `date_first_issue_online`, `date_last_issue_online`, `title_url`,
`title_id`, ...); a non-empty `date_last_issue_online` means coverage has ended.
For `frontiers-titlelist-web-2026.csv`, skip to
the real header line (`Journal,ISSN,URL`) before parsing — the file starts
with consortium metadata, not data.
