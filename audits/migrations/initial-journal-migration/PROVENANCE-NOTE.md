# Provenance correction for v0.1

`audit-summary.json` and `manifest.json` in this directory report different
`engine_commit`/`schema_commit` values for the same audit run:

| Field | `audit-summary.json` | `manifest.json` |
|---|---|---|
| engine_commit | `d637a2672208ddd688034fa4b430417378f4006f` | `0eba531cec4258e02b85ae65254b65e33e3ecc2f` |
| schema_commit | `2f099e80ee1d6ee553fddf0b4bef478f6fc2d889` | `1ed194f4a5fdbccabbd603516a84867f7efa06a4` |

**Why:** `audit-summary.json` is a direct copy of the file
`migrate-journals-dry-run.mjs` wrote at the moment the dry run actually
executed. At that moment, `src/migration/` existed only in the working
tree — it had not yet been committed to `posi-engine` — so `git rev-parse
HEAD` inside the script correctly reported the *prior* commit
(`d637a267`), which does not contain the migration pipeline at all. The
same applies to `posi-data`: the identity-priority tightening
(`1ed194f4`) was pushed after this run, so the script's `--schema-commit`
argument recorded the prior commit (`2f099e80`).

**Which value to trust:** `manifest.json`'s `engine_commit`
(`0eba531cec4258e02b85ae65254b65e33e3ecc2f`) and `schema_commit`
(`1ed194f4a5fdbccabbd603516a84867f7efa06a4`) — filled in by hand after
pushing, once both commits actually existed — are the ones that reproduce
this audit: `git checkout 0eba531c...` in `posi-engine`, run
`scripts/migrate-journals-dry-run.mjs` against the same
`migration-source.jsonl` (pinned by `source_commit`, which was correct in
both files), and the output matches what's published here (see the
determinism claim in `manifest.json`).

**What changes going forward:** every future audit manifest in this
repository uses two unambiguous fields instead of `engine_commit`:

- `generator_commit` — the commit that, checked out, reproduces this run's
  output. Always recorded *after* that commit is pushed, never read live
  from a working tree mid-run.
- `spec_commit` — the `posi-data` commit whose schemas/PJR-SPEC.md this run
  was validated against, same rule.

This file is a correction, not a silent edit — `audit-summary.json` is left
as originally published (it's an accurate record of what the running
script actually saw at the time, which has its own value), and this note
is the pointer to the values that are actually checkout-able.
