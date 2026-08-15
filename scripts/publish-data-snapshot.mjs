#!/usr/bin/env node
/**
 * publish-data-snapshot.mjs
 *
 * Builds a data snapshot for posi-data-delivery (the public, GitHub-Pages-
 * hosted read layer — see that repo's README) from this repo's own
 * corpus/. Deliberately does NOT produce a POSI-R-* release: POSI-R-1.0-
 * SPEC.md is explicit that no POSI-R-* release has ever been produced (no
 * pinned engine run, no reviewed manifest, no cut decision) — this script
 * only mirrors already-committed corpus data to a public, versioned,
 * immutable URL. A real POSI-R release is a separate, later, explicitly
 * human-triggered step (see that spec's § 5: cutting a release is not the
 * same action as publishing a snapshot).
 *
 * Output layout (written into --out, expected to be a posi-data-delivery
 * clone):
 *
 *   current.json                        -- points at the latest snapshot
 *   snapshots/<snapshot-id>/manifest.json
 *   snapshots/<snapshot-id>/SHA256SUMS
 *   snapshots/<snapshot-id>/collections/core-collection.json
 *   snapshots/<snapshot-id>/collections/benchmark-curated.json
 *   snapshots/<snapshot-id>/collections/publisher-catalog.json
 *   snapshots/<snapshot-id>/collections/pcs.json
 *   snapshots/<snapshot-id>/collections/pci.json
 *
 * collections/pcs.json is an aggregation of the PCS (POSI Citation Score,
 * PCS-1.0-SPEC.md) ETL audit's per-journal output files
 * (audits/pcs-etl/<run>/pcs/<shard>/<posi_id>.json, sharded per posi-
 * engine's src/sharding.mjs metricPath() convention) into one JSON array,
 * one entry per journal that has a journal_id -- including journals with
 * pcs: null, so a consumer can distinguish "computed, no PCS" from "never
 * attempted." Each entry is passed through unmodified: it is already
 * exactly the schema/metric.schema.json-declared PCS field subset (see
 * that audit's own README), so this script does not rename or reshape any
 * field. There is no posi-engine release workflow yet that writes PCS into
 * metrics/<year>/<shard>/ (posi-data/CONTRIBUTING.md restricts that path to
 * a release workflow that doesn't exist), so for now this reads directly
 * from the named audit directory -- pass --pcs-audit-dir to point at a
 * newer PCS run when one supersedes this one.
 *
 * collections/pci.json is the same pattern applied to PCI/PCI-5
 * (audits/pjr-seed-corpus/<run>/pci/<shard>/<posi_id>.json) -- see that
 * audit's own README (pjr-seed-corpus-global993-2026) for scope (curated
 * Global Benchmark only, not Core Collection -- most Core Collection
 * journals are too young to have any real 2023-2024 output yet) and the
 * two real bugs found and fixed during that run. Pass --pci-audit-dir to
 * point at a newer PCI run when one supersedes this one.
 *
 * Once written, a snapshot directory is never edited in place — a
 * corrected or updated snapshot gets a new <snapshot-id> (today's date;
 * append -2, -3... within the same day if published more than once) and
 * current.json is repointed. Same discipline as PJR-SPEC.md § 7 /
 * POSI-R-1.0-SPEC.md § 2's revision rule, applied to snapshots instead of
 * releases since no release exists yet.
 *
 * manifest.json fields intentionally mirror POSI-R-1.0-SPEC.md § 4's
 * shape (lifecycle_version, psc_crosswalk_version, ajr_e_version, ...)
 * so upgrading a future snapshot into a real POSI-R release is a rename,
 * not a redesign — but `is_official_release: false` and `release: null`
 * make it impossible to mistake this for one in the meantime.
 *
 * Usage:
 *   node scripts/publish-data-snapshot.mjs \
 *     --out <path to posi-data-delivery clone> \
 *     [--engine-commit <posi-engine git sha>] \
 *     [--snapshot-id 2026-08-13] \
 *     [--pcs-audit-dir path] [--pci-audit-dir path]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'

// Default PCS ETL audit run this snapshot pulls collections/pcs.json from.
// See the file header comment above for why this reads an audit directory
// rather than a real metrics/ release path.
const PCS_AUDIT_DIR_DEFAULT = 'audits/pcs-etl/pcs-etl-v1-global1024-2026'

// Default PCI ETL audit run this snapshot pulls collections/pci.json from.
const PCI_AUDIT_DIR_DEFAULT = 'audits/pjr-seed-corpus/pjr-seed-corpus-global993-2026'

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : fallback
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Walks <auditDir>/<subdir>/<shard>/<posi_id>.json (256 possible shard
 * dirs, per posi-engine's sharding.mjs metricPath() convention) and
 * returns the records as a flat array, sorted by journal_id for a stable,
 * diffable output file. Returns null if <auditDir>/<subdir> doesn't
 * exist, so callers can decide whether that's fatal. Shared by
 * collections/pcs.json and collections/pci.json — same shard layout,
 * different metric subdirectory.
 */
function collectShardedRecords(auditDir, subdir) {
  const dir = resolve(auditDir, subdir)
  if (!existsSync(dir)) return null

  const records = []
  for (const shard of readdirSync(dir)) {
    const shardDir = join(dir, shard)
    if (!statSync(shardDir).isDirectory()) continue
    for (const file of readdirSync(shardDir)) {
      if (!file.endsWith('.json')) continue
      records.push(JSON.parse(readFileSync(join(shardDir, file), 'utf-8')))
    }
  }
  records.sort((a, b) => (a.journal_id < b.journal_id ? -1 : a.journal_id > b.journal_id ? 1 : 0))
  return records
}

function main() {
  const outDir = resolve(arg('out'))
  if (!existsSync(outDir)) throw new Error(`--out directory does not exist: ${outDir}. Clone posi-data-delivery first.`)

  // Defaults to HEAD, but accepts an override for the case where the
  // working tree's actual HEAD is a local-only merge/combination commit
  // that doesn't exist on any pushed branch (e.g. temporarily merging two
  // still-open PR branches locally to generate a snapshot reflecting
  // both) -- data_commit must point at something a reader can actually
  // fetch and inspect on GitHub.
  const dataCommit = arg('data-commit') ?? execSync('git rev-parse HEAD', { cwd: resolve('.'), encoding: 'utf-8' }).trim()
  const engineCommit = arg('engine-commit')
  if (!engineCommit) throw new Error('--engine-commit is required (posi-engine git SHA the snapshot data was computed with)')

  const today = new Date().toISOString().slice(0, 10)
  const snapshotId = arg('snapshot-id', today)

  const coreCollection = JSON.parse(readFileSync(resolve('corpus/core-collection.json'), 'utf-8'))
  const globalBenchmark = JSON.parse(readFileSync(resolve('corpus/global-benchmark.json'), 'utf-8'))
  const curated = globalBenchmark.filter(j => !j.source_note)
  const publisherCatalog = globalBenchmark.filter(j => !!j.source_note)

  const pcsAuditDir = arg('pcs-audit-dir', PCS_AUDIT_DIR_DEFAULT)
  const pcsRecords = collectShardedRecords(pcsAuditDir, 'pcs')
  if (pcsRecords === null) {
    console.warn(`Warning: no PCS audit found at ${pcsAuditDir}/pcs -- collections/pcs.json will not be published this run.`)
  }
  const pcsComputedCount = pcsRecords ? pcsRecords.filter(r => r.pcs != null).length : 0

  const pciAuditDir = arg('pci-audit-dir', PCI_AUDIT_DIR_DEFAULT)
  const pciRecords = collectShardedRecords(pciAuditDir, 'pci')
  if (pciRecords === null) {
    console.warn(`Warning: no PCI audit found at ${pciAuditDir}/pci -- collections/pci.json will not be published this run.`)
  }
  const pciComputedCount = pciRecords ? pciRecords.filter(r => r.pci != null).length : 0

  const snapshotDir = join(outDir, 'snapshots', snapshotId)
  const collectionsDir = join(snapshotDir, 'collections')
  mkdirSync(collectionsDir, { recursive: true })

  const files = {
    'collections/core-collection.json': JSON.stringify(coreCollection, null, 2) + '\n',
    'collections/benchmark-curated.json': JSON.stringify(curated, null, 2) + '\n',
    'collections/publisher-catalog.json': JSON.stringify(publisherCatalog),
  }
  if (pcsRecords !== null) {
    files['collections/pcs.json'] = JSON.stringify(pcsRecords, null, 2) + '\n'
  }
  if (pciRecords !== null) {
    files['collections/pci.json'] = JSON.stringify(pciRecords, null, 2) + '\n'
  }
  const checksums = []
  for (const [relPath, content] of Object.entries(files)) {
    writeFileSync(join(snapshotDir, relPath), content, 'utf-8')
    checksums.push(`${sha256(content)}  ${relPath}`)
  }

  // Counts computed directly from the corpus being published, not asserted
  // separately — a reader can recompute every one of these from the
  // collections/ files above.
  const earlyStageRated = coreCollection.filter(j => ['official', 'provisional'].includes(j.early_stage_rating?.rating_status) && j.early_stage_rating?.total != null).length
  // Always 0: AJR-M is implemented (posi-engine's ajr-mature.mjs) but has
  // not been run against real data for any journal yet — see AJR-M-1.0-
  // SPEC.md and the website's frozen "AJR-M Score: Not Yet Available"
  // copy. Computed explicitly (not hardcoded) so this becomes non-zero
  // automatically, without code changes, once real AJR-M data exists.
  const matureRated = coreCollection.filter(j => j.early_stage_rating?.lifecycle_stage === 'mature' && j.early_stage_rating?.version?.startsWith('AJR-M') && j.early_stage_rating?.total != null).length

  const manifest = {
    snapshot: snapshotId,
    type: 'pre_release_data_snapshot',
    is_official_release: false,
    release: null,
    note: 'Not a POSI-R release -- no POSI-R-* release has been produced yet (see posi-data/POSI-R-1.0-SPEC.md). This is a public mirror of already-committed corpus data, refreshed on demand.',
    generated_at: new Date().toISOString(),
    data_cutoff: today,
    lifecycle_version: 'LIFECYCLE-1.1',
    psc_crosswalk_version: 'PSC-CROSSWALK-0.2',
    ajr_e_version: 'AJR-E-1.1',
    ajr_m_version: 'AJR-M-1.0',
    rank_version: 'RANK-1.0',
    evidence_version: 'EVIDENCE-1.0',
    diagnostics_version: 'DIAG-1.0',
    // 'PCS-1.0' once a real PCS collection is actually published in this
    // snapshot (mirrors how ajr_e_version/ajr_m_version reflect the spec
    // version currently in force, not merely "some data exists"); falls
    // back to 'Pending' if this run had no PCS audit to read from.
    pcs_version: pcsRecords !== null ? 'PCS-1.0' : 'Pending',
    // 'PCI-1.0' once a real PCI collection is actually published in this
    // snapshot, mirroring pcs_version's own convention above. Scope note:
    // covers curated Global Benchmark only, not Core Collection -- see
    // pjr-seed-corpus-global993-2026/README.md.
    pci_version: pciRecords !== null ? 'PCI-1.0' : 'Pending',
    pjr_release: null,
    data_commit: dataCommit,
    engine_commit: engineCommit,
    journal_count: coreCollection.length + globalBenchmark.length,
    core_collection_count: coreCollection.length,
    benchmark_curated_count: curated.length,
    benchmark_publisher_catalog_count: publisherCatalog.length,
    early_stage_rated_count: earlyStageRated,
    mature_rated_count: matureRated,
    // Of the journals in collections/pcs.json, how many have a non-null
    // pcs value -- distinguishes "computed, no PCS" (a real, disclosed
    // finding — see pcs-etl-v1-global1024-2026/README.md) from "never
    // attempted." 0 if this snapshot has no PCS collection at all.
    pcs_computed_count: pcsComputedCount,
    // Of the journals in collections/pci.json, how many have a non-null
    // pci value. 0 if this snapshot has no PCI collection at all. Scope is
    // Global Benchmark only this run (990/993) -- Core Collection has none
    // yet (see pjr-seed-corpus-global993-2026/README.md's scope note).
    pci_computed_count: pciComputedCount,
    supersedes: null,
  }
  const manifestJson = JSON.stringify(manifest, null, 2) + '\n'
  writeFileSync(join(snapshotDir, 'manifest.json'), manifestJson, 'utf-8')
  checksums.push(`${sha256(manifestJson)}  manifest.json`)
  writeFileSync(join(snapshotDir, 'SHA256SUMS'), checksums.sort().join('\n') + '\n', 'utf-8')

  const current = {
    type: 'pre_release_data_snapshot',
    is_official_release: false,
    snapshot: snapshotId,
    manifest: `/snapshots/${snapshotId}/manifest.json`,
    note: 'No POSI-R-* release exists yet -- this points at the current pre-release data snapshot, refreshed on demand rather than on a fixed schedule. See manifest.json for exact provenance (data_commit/engine_commit) and per-component versions.',
  }
  writeFileSync(join(outDir, 'current.json'), JSON.stringify(current, null, 2) + '\n', 'utf-8')

  console.log(`Wrote snapshot ${snapshotId} to ${snapshotDir}`)
  console.log(JSON.stringify(manifest, null, 2))
}

main()
