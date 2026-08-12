# Reproducibility verification — initial-journal-migration-audit-v0.1

`audit-summary.md`'s "Next steps" #3 asked for the dry run to be executed a
second time against the same input and the two `migration-audit.json`
outputs diffed. This had never been done — this file records that it now
has, and that the pipeline is reproducible end to end, from the website
repo's raw TypeScript data files through to the published audit artifacts.

## What was verified, in order

### 1. The Legacy Export Adapter (website repo) is deterministic

`manifest.json`'s `source_commit` (`9b2d4ad90073ae069c7d47a25af7778e5e41a65f`)
predates the commit that added the export adapter
(`scripts/export-for-posi-migration.mjs`, added in the very next commit,
`c57aed954c27c2423e36972c655b9824340ba0a6`). Diffing `src/lib/data.ts`,
`src/lib/discovered-journals.ts`, and `src/lib/types.ts` between those two
commits confirms they are byte-identical — the adapter commit touches only
the new script, not the data it reads. So checking out `c57aed9` (not
`9b2d4ad` directly, which lacks the adapter) reproduces exactly the data
snapshot `source_commit` pins.

Running `node scripts/export-for-posi-migration.mjs` against that checkout
twice:

```
sha256(migration-source-run1.jsonl) = 9c3ab7dfbf9b5fc234cbf7d909e95e6eea82e702a7a410b5fee5467ab40e2301
sha256(migration-source-run2.jsonl) = 9c3ab7dfbf9b5fc234cbf7d909e95e6eea82e702a7a410b5fee5467ab40e2301
```

Byte-identical. 23,822 records both times, matching `audit-summary.md`'s
headline count.

### 2. The dry-run migration pipeline (posi-engine) is deterministic

`manifest.json`'s trusted `engine_commit` (`0eba531cec4258e02b85ae65254b65e33e3ecc2f`
— see `PROVENANCE-NOTE.md` for why `manifest.json`'s value is the one to
trust, not `audit-summary.json`'s) checked out, running
`scripts/migrate-journals-dry-run.mjs` against the regenerated
`migration-source.jsonl` twice:

```
diff migration-audit.json (run1) migration-audit.json (run2)
  -> identical except "generated_at"
diff candidate-entities.jsonl, duplicate-groups.jsonl, hard-conflicts.csv,
     invalid-identifiers.csv, possible-duplicates.csv, unresolved-records.jsonl,
     normalization-warnings.csv (run1 vs run2)
  -> byte-identical, no exceptions
```

### 3. The regenerated run matches what was actually published

Diffing this regenerated run's output against the files already committed
in this directory (`hard-conflicts.csv`, `invalid-identifiers.csv`,
`possible-duplicates.csv`, `duplicate-groups.jsonl`,
`unresolved-records.jsonl`, `audit-summary.json`) and against the
`candidate-entities.jsonl.gz` release asset on the
`initial-journal-migration-audit-v0.1` GitHub Release:

- Every CSV/JSONL file: byte-identical (line-ending normalized; the
  committed files are CRLF from a Windows checkout, content is identical).
- `audit-summary.json` vs the regenerated `migration-audit.json`: identical
  once `--schema-commit 2f099e80ee1d6ee553fddf0b4bef478f6fc2d889` is passed
  (the original run's actual invocation, distinct from `manifest.json`'s
  corrected `spec_commit` value — see `PROVENANCE-NOTE.md`) and
  `generated_at` is excluded. The only other field that differs is
  `engine_commit` itself, which is the exact discrepancy `PROVENANCE-NOTE.md`
  already documents and explains (the original run's live `git rev-parse
  HEAD` reported the prior commit because `src/migration/` wasn't committed
  yet at the moment the script executed) — not a new reproducibility
  failure.
- `candidate-entities.jsonl` released asset:
  `sha256=0c21b73bb231520ee30a4f4151706ebe82324451799bb26af006b1d568a3009b`,
  identical to the regenerated file and to `manifest.json`'s recorded
  checksum.

## Verdict

**PASS.** Both stages of the pipeline (export adapter, migration dry run)
are deterministic, and the previously-published audit outputs are exactly
what a clean re-run reproduces. This audit is trusted for the real
migration that follows (see `../../../registry/journal-id-map.csv` and
`../../../journals/discovered/initial-journal-migration-2026.jsonl`).

## How to reproduce this verification

```sh
# 1. Website repo: check out the commit right after source_commit (has the
#    export adapter, identical data files) and export the source snapshot.
git clone https://github.com/WENSHAO521/Panorama-Open-Scholarly-Index
cd Panorama-Open-Scholarly-Index
git checkout c57aed954c27c2423e36972c655b9824340ba0a6
npm install
node scripts/export-for-posi-migration.mjs --out migration-source.jsonl

# 2. posi-engine: check out the trusted engine_commit and run the dry run twice.
git clone https://github.com/WENSHAO521/posi-engine
cd posi-engine
git checkout 0eba531cec4258e02b85ae65254b65e33e3ecc2f
node scripts/migrate-journals-dry-run.mjs \
  --in ../Panorama-Open-Scholarly-Index/migration-source.jsonl \
  --out ./run1 \
  --source-repository WENSHAO521/Panorama-Open-Scholarly-Index \
  --source-commit 9b2d4ad90073ae069c7d47a25af7778e5e41a65f \
  --schema-commit 2f099e80ee1d6ee553fddf0b4bef478f6fc2d889
node scripts/migrate-journals-dry-run.mjs \
  --in ../Panorama-Open-Scholarly-Index/migration-source.jsonl \
  --out ./run2 \
  --source-repository WENSHAO521/Panorama-Open-Scholarly-Index \
  --source-commit 9b2d4ad90073ae069c7d47a25af7778e5e41a65f \
  --schema-commit 2f099e80ee1d6ee553fddf0b4bef478f6fc2d889

diff run1 run2   # identical apart from generated_at in migration-audit.json/md
```
