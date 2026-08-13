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
 *     [--snapshot-id 2026-08-13]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : fallback
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function main() {
  const outDir = resolve(arg('out'))
  if (!existsSync(outDir)) throw new Error(`--out directory does not exist: ${outDir}. Clone posi-data-delivery first.`)

  const dataCommit = execSync('git rev-parse HEAD', { cwd: resolve('.'), encoding: 'utf-8' }).trim()
  const engineCommit = arg('engine-commit')
  if (!engineCommit) throw new Error('--engine-commit is required (posi-engine git SHA the snapshot data was computed with)')

  const today = new Date().toISOString().slice(0, 10)
  const snapshotId = arg('snapshot-id', today)

  const coreCollection = JSON.parse(readFileSync(resolve('corpus/core-collection.json'), 'utf-8'))
  const globalBenchmark = JSON.parse(readFileSync(resolve('corpus/global-benchmark.json'), 'utf-8'))
  const curated = globalBenchmark.filter(j => !j.source_note)
  const publisherCatalog = globalBenchmark.filter(j => !!j.source_note)

  const snapshotDir = join(outDir, 'snapshots', snapshotId)
  const collectionsDir = join(snapshotDir, 'collections')
  mkdirSync(collectionsDir, { recursive: true })

  const files = {
    'collections/core-collection.json': JSON.stringify(coreCollection, null, 2) + '\n',
    'collections/benchmark-curated.json': JSON.stringify(curated, null, 2) + '\n',
    'collections/publisher-catalog.json': JSON.stringify(publisherCatalog),
  }
  const checksums = []
  for (const [relPath, content] of Object.entries(files)) {
    writeFileSync(join(snapshotDir, relPath), content, 'utf-8')
    checksums.push(`${sha256(content)}  ${relPath}`)
  }

  // Counts computed directly from the corpus being published, not asserted
  // separately — a reader can recompute every one of these from the
  // collections/ files above.
  const earlyStageRated = coreCollection.filter(j => j.early_stage_rating?.eligibility === 'early_stage' && j.early_stage_rating?.total != null).length
  // Always 0: AJR-M is implemented (posi-engine's ajr-mature.mjs) but has
  // not been run against real data for any journal yet — see AJR-M-1.0-
  // SPEC.md and the website's frozen "AJR-M Score: Not Yet Available"
  // copy. Computed explicitly (not hardcoded) so this becomes non-zero
  // automatically, without code changes, once real AJR-M data exists.
  const matureRated = coreCollection.filter(j => j.early_stage_rating?.eligibility === 'mature' && j.early_stage_rating?.version?.startsWith('AJR-M')).length

  const manifest = {
    snapshot: snapshotId,
    type: 'pre_release_data_snapshot',
    is_official_release: false,
    release: null,
    note: 'Not a POSI-R release -- no POSI-R-* release has been produced yet (see posi-data/POSI-R-1.0-SPEC.md). This is a public mirror of already-committed corpus data, refreshed on demand.',
    generated_at: new Date().toISOString(),
    data_cutoff: snapshotId,
    lifecycle_version: 'LIFECYCLE-1.1',
    psc_crosswalk_version: 'PSC-CROSSWALK-0.2',
    ajr_e_version: 'AJR-E-1.1',
    ajr_m_version: 'AJR-M-1.0',
    rank_version: 'RANK-1.0',
    evidence_version: 'EVIDENCE-1.0',
    diagnostics_version: 'DIAG-1.0',
    pcs_version: 'Pending',
    pci_version: 'Pending',
    pjr_release: null,
    data_commit: dataCommit,
    engine_commit: engineCommit,
    journal_count: coreCollection.length + globalBenchmark.length,
    core_collection_count: coreCollection.length,
    benchmark_curated_count: curated.length,
    benchmark_publisher_catalog_count: publisherCatalog.length,
    early_stage_rated_count: earlyStageRated,
    mature_rated_count: matureRated,
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
