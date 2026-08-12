# Evidence ETL v1 — Core Collection Audit (31 journals)

Real run of `posi-engine`'s Evidence ETL pipeline against Core Collection,
against the fully production-hardened engine (canonical AJR-E evidence
ids, the missing `other_applicable_terms` criterion, tightened
false-positive patterns, same-origin/anchor-text/robots-grouping/
publisher-verification fixes, operational robustness for the 1000-journal
scale-up). See [audit-summary.md](./audit-summary.md) for the full
narrative.

**Short version:** 19/31 journals resolved at 100% site evidence
coverage; 12 (every one hosted on `ojs.shiharr.com`, SHIHARR Publishing's
shared OJS platform) show real, verified-live infrastructure timeouts —
confirmed by a direct manual fetch immediately after the crawl, and by
three follow-up probes showing the host is intermittently responsive
(2/3 succeeded), not in a hard outage. This is the resolver correctly
reporting `unknown` for a genuine "we couldn't get through" situation,
which is exactly the failure mode this pass's fixes exist to surface
honestly instead of silently reading as a confident (and wrong) `not_met`.
**This run's data is committed as a real, timestamped snapshot as-is** —
recommend a targeted re-crawl of the 12 affected journals
(`POSI-J-000016`–`POSI-J-000027`) once `ojs.shiharr.com` is confirmed
stable, before using their evidence for anything downstream.

## Files

- `audit-summary.md` — full report: numbers, the shiharr.com finding and
  how it was verified, per-criterion breakdown, what changed from
  pre-hardening runs.
- `audit-summary.json` — machine-readable summary (final run).
- `per-journal-coverage.csv` — one row per journal.
- `path-hit-rate.csv` — per-candidate-path hit rate.

## What changed outside this directory

- `evidence/journals/<posi_id>.json` — 31 files, replaced with this run's
  output. **Field names changed**: evidence item `id`s are now AJR-E's
  canonical ids (e.g. `aims_scope_explicit`, not `aims_scope`) — see
  companion posi-engine PR (evidence-etl-v1 branch) for why.
- `evidence/publishers/` — unchanged, still empty.

Nothing in `corpus/core-collection.json` changed. Companion posi-engine PR
has the resolver/fetch-layer/orchestrator fixes and the full commit
history of what was found and fixed across four review-and-fix rounds.
