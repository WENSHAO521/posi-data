#!/usr/bin/env node
/**
 * publish-data-snapshot.mjs
 *
 * Builds a data snapshot for posi-data-delivery (the public, GitHub-Pages-
 * hosted read layer — see that repo's README) from this repo's own
 * corpus/. It does not cut a POSI-R-* release: cutting one is a separate,
 * explicitly human-triggered step that commits a reviewed manifest to
 * releases/<release>/manifest.json (POSI-R-1.0-SPEC.md § 4-5). This script
 * only recognises releases: the manifest lists the SHA-256 of every
 * collection file the release contains, and a snapshot whose collections
 * are byte-identical to the newest release's is published as that release
 * (type "official_release"). A snapshot built from data changed since the
 * release is published as "post_release_data_snapshot", naming the release
 * it follows. The release is defined by its content, not by a commit, so
 * the commit that adds the manifest does not change what it describes.
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
 *   snapshots/<snapshot-id>/collections/citation-ranking.json.gz -- POSI Citation Ranking edition
 *                                         (POSI-EVAL-1.0-SPEC.md: PNCI-1.0, CITATION-RANK-1.0, POSI-ZONES-2.0)
 *   snapshots/<snapshot-id>/collections/pcs-q.json.gz    -- PCS edition (PCS values; its PCS-Q
 *                                         quartiles are retired as a ranking, POSI-EVAL-1.0)
 *   releases/<release>/manifest.json    -- copy of each committed release manifest
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
 * audit's own README (pjr-seed-corpus-global993-2026) for scope (Core
 * Collection + curated Global Benchmark; most Core Collection journals
 * are too young to have any real 2023-2024 output yet -- 2 of 30 do) and
 * the two real bugs found and fixed during that run. Pass --pci-audit-dir
 * to point at a newer PCI run when one supersedes this one.
 *
 * collections/citation-rankings.json is real Citation Q data
 * (audits/<run>/rankings/<shard>/<posi_id>.json, schema/ranking.schema.json)
 * -- deliberately Core Collection journal_ids ONLY, even though the
 * ranking peer pool used to compute each one included Global Benchmark
 * journals to reach PJR-SPEC.md § 8's MIN_CATEGORY_SIZE=20 threshold. The
 * site's own rule is that Global Benchmark journals are never assigned a
 * displayed Citation Rank/Percentile/Quartile (they're a validation
 * corpus, not POSI-admitted) -- pooling them as peers to compute someone
 * else's percentile is fine; publishing their own rank would not be. This
 * audit's own ranking-generation step already only wrote records for
 * Core Collection journal_ids, so no extra filtering is needed here.
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
 *     [--checksums-only]   print the collection checksums a release manifest records, write nothing
 *     [--with-versions]    with --checksums-only: also print the manifest's component versions as "_versions"
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import { gunzipSync, gzipSync } from 'zlib'

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

/** Committed release manifests (releases/<release>/manifest.json), newest first. */
function loadReleases() {
  const dir = resolve('releases')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .map(id => join(dir, id, 'manifest.json'))
    .filter(f => existsSync(f))
    .map(f => JSON.parse(readFileSync(f, 'utf-8')))
    .sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : 0))
}

/**
 * The highest version stamp among the published ratings (e.g. 'AJR-E-1.2'),
 * so the manifest names the version the data was actually rated with and
 * cannot fall behind posi-engine. `fallback` is the version in force when no
 * journal carries a stamp yet.
 */
function newestVersion(stamps, fallback) {
  const key = v => (/(\d+(?:\.\d+)*)$/.exec(v)?.[1] ?? '').split('.').map(Number)
  const newer = (a, b) => {
    const [x, y] = [key(a), key(b)]
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
    return false
  }
  return stamps.filter(Boolean).reduce((best, v) => (best === null || newer(v, best) ? v : best), null) ?? fallback
}

function main() {
  const checksumsOnly = process.argv.includes('--checksums-only')
  const outDir = checksumsOnly ? null : resolve(arg('out'))
  if (!checksumsOnly && !existsSync(outDir)) throw new Error(`--out directory does not exist: ${outDir}. Clone posi-data-delivery first.`)

  // Defaults to HEAD, but accepts an override for the case where the
  // working tree's actual HEAD is a local-only merge/combination commit
  // that doesn't exist on any pushed branch (e.g. temporarily merging two
  // still-open PR branches locally to generate a snapshot reflecting
  // both) -- data_commit must point at something a reader can actually
  // fetch and inspect on GitHub.
  const dataCommit = arg('data-commit') ?? execSync('git rev-parse HEAD', { cwd: resolve('.'), encoding: 'utf-8' }).trim()
  const engineCommit = arg('engine-commit')
  if (!engineCommit && !checksumsOnly) throw new Error('--engine-commit is required (posi-engine git SHA the snapshot data was computed with)')

  const today = new Date().toISOString().slice(0, 10)
  const snapshotId = arg('snapshot-id', today)

  // A journal whose collection_status is 'withdrawn' (taken out of the database after admission, e.g. no
  // DOIs so it cannot be indexed) stays in the corpus, so its id and history are kept, but it is not
  // published: not in the collections, not in the per-journal PCS/PCI/Citation-Q records, and not in
  // any count below. The Citation Ranking and PCS editions are imported from posi-engine and passed
  // through unmodified (neither carries the one journal withdrawn so far).
  const corpusCore = JSON.parse(readFileSync(resolve('corpus/core-collection.json'), 'utf-8'))
  const corpusGlobal = JSON.parse(readFileSync(resolve('corpus/global-benchmark.json'), 'utf-8'))
  const isWithdrawn = j => j.collection_status === 'withdrawn'
  const withdrawnIds = new Set([...corpusCore, ...corpusGlobal].filter(isWithdrawn).map(j => j.posi_id))
  const coreCollection = corpusCore.filter(j => !isWithdrawn(j))
  const globalBenchmark = corpusGlobal.filter(j => !isWithdrawn(j))
  const withoutWithdrawn = records => (records === null ? null : records.filter(r => !withdrawnIds.has(r.journal_id)))
  const curated = globalBenchmark.filter(j => !j.source_note)
  const publisherCatalog = globalBenchmark.filter(j => !!j.source_note)

  const pcsAuditDir = arg('pcs-audit-dir', PCS_AUDIT_DIR_DEFAULT)
  const pcsRecords = withoutWithdrawn(collectShardedRecords(pcsAuditDir, 'pcs'))
  if (pcsRecords === null) {
    console.warn(`Warning: no PCS audit found at ${pcsAuditDir}/pcs -- collections/pcs.json will not be published this run.`)
  }
  const pcsComputedCount = pcsRecords ? pcsRecords.filter(r => r.pcs != null).length : 0

  const pciAuditDir = arg('pci-audit-dir', PCI_AUDIT_DIR_DEFAULT)
  const pciRecords = withoutWithdrawn(collectShardedRecords(pciAuditDir, 'pci'))
  if (pciRecords === null) {
    console.warn(`Warning: no PCI audit found at ${pciAuditDir}/pci -- collections/pci.json will not be published this run.`)
  }
  const pciComputedCount = pciRecords ? pciRecords.filter(r => r.pci != null).length : 0

  const rankingRecords = withoutWithdrawn(collectShardedRecords(pciAuditDir, 'rankings'))
  const rankedCount = rankingRecords ? rankingRecords.filter(r => r.ranking_method !== 'unavailable').length : 0

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
  if (rankingRecords !== null && rankingRecords.length > 0) {
    files['collections/citation-rankings.json'] = JSON.stringify(rankingRecords, null, 2) + '\n'
  }
  // POSI Citation Ranking (POSI-EVAL-1.0-SPEC.md): the newest
  // rankings/citation/citation-ranking-<year>.json.gz edition, imported from
  // posi-engine by import-global-index, passed through unmodified. This is
  // the only ranking POSI publishes.
  const citationDir = resolve('rankings', 'citation')
  const citationFile = existsSync(citationDir)
    ? readdirSync(citationDir).filter(f => /^citation-ranking-\d{4}\.json(\.gz)?$/.test(f)).sort().pop() ?? null
    : null
  const citationRaw = citationFile ? readFileSync(join(citationDir, citationFile)) : null
  const citationEdition = citationRaw ? JSON.parse((citationFile.endsWith('.gz') ? gunzipSync(citationRaw) : citationRaw).toString('utf-8')) : null
  if (citationEdition) files['collections/citation-ranking.json.gz'] = gzipSync(JSON.stringify(citationEdition) + '\n', { level: 9 })
  // PCS edition (formerly PCS-Q, PCS-Q-1.0-SPEC.md): the newest rankings/pcs-q/pcs-q-<year>.json
  // edition (stored gzipped, .json.gz, since the global edition), passed
  // through unmodified. Published gzipped as collections/pcs-q.json.gz: the
  // global edition is ~90 MB as JSON, and every snapshot holds a full copy.
  // gzipSync writes no timestamp, so the same edition gives the same bytes.
  const pcsQDir = resolve('rankings', 'pcs-q')
  const pcsQFile = existsSync(pcsQDir)
    ? readdirSync(pcsQDir).filter(f => /^pcs-q-\d{4}\.json(\.gz)?$/.test(f)).sort().pop() ?? null
    : null
  const pcsQRaw = pcsQFile ? readFileSync(join(pcsQDir, pcsQFile)) : null
  const pcsQEdition = pcsQRaw ? JSON.parse((pcsQFile.endsWith('.gz') ? gunzipSync(pcsQRaw) : pcsQRaw).toString('utf-8')) : null
  if (pcsQEdition) files['collections/pcs-q.json.gz'] = gzipSync(JSON.stringify(pcsQEdition) + '\n', { level: 9 })
  // The two editions are generated and checksummed as wholes (posi-engine; posi-data-delivery archives each by its
  // SHA-256), and their ranks are computed across all journals, so removing a record here would change the
  // edition's identity and leave it inconsistent. A withdrawn journal in one is therefore not removed but makes
  // the snapshot fail: the fix is a regenerated edition without it.
  for (const [name, edition] of [['Citation Ranking', citationEdition], ['PCS', pcsQEdition]]) {
    const carried = edition ? edition.records.filter(r => withdrawnIds.has(r.journal_id)).map(r => r.journal_id) : []
    if (carried.length > 0) {
      const msg = `the ${name} edition still contains ${carried.length} withdrawn journal(s) (${carried.join(', ')}); regenerate the edition without them`
      // A withdrawn journal must not be published. Writing a snapshot stops here; a
      // checksum check only warns, so the sync reports the failure at the build step.
      if (!checksumsOnly) throw new Error(msg)
      console.warn(`Warning: ${msg}.`)
    }
  }
  const versions = {
    lifecycle_version: 'LIFECYCLE-1.1',
    psc_crosswalk_version: 'PSC-CROSSWALK-0.3',
    ajr_e_version: newestVersion(coreCollection.map(j => j.early_stage_rating?.version), 'AJR-E-1.2'),
    ajr_m_version: newestVersion(coreCollection.map(j => j.mature_rating?.methodology_version), 'AJR-M-1.2'),
    // Archived E-Q/M-Q/Citation Q/PCS-Q ranking core; retired as published rankings (POSI-EVAL-1.0).
    rank_version: 'RANK-1.0',
    evaluation_version: 'POSI-EVAL-1.0',
    citation_rank_version: citationEdition?.ranking_methodology_version ?? 'Pending',
    pnci_version: citationEdition?.pnci_model_version ?? 'Pending',
    zones_version: citationEdition?.zones_version ?? 'Pending',
    citation_ranking_metric_year: citationEdition?.metric_year ?? null,
    ranking_snapshot_date: citationEdition?.snapshot_date ?? null,
    citation_ranking_official_count: citationEdition ? citationEdition.records.filter(r => r.citation_ranking_status === 'official').length : 0,
    citation_ranking_ranked_count: citationEdition ? citationEdition.records.filter(r => r.citation_rank != null).length : 0,
    evidence_version: 'EC-1.1',
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
    pcs_q_version: pcsQEdition?.methodology_version ?? 'Pending',
  }
  const fileSums = Object.fromEntries(Object.entries(files).map(([relPath, content]) => [relPath, sha256(content)]))
  if (checksumsOnly) {
    console.log(JSON.stringify(process.argv.includes('--with-versions') ? { ...fileSums, _versions: versions } : fileSums, null, 2))
    return
  }

  // A snapshot IS a release when its collections are byte-identical to
  // the newest release's (the release manifest's `files`).
  const latestRelease = loadReleases()[0] ?? null
  const isRelease = !!latestRelease?.files &&
    Object.keys(latestRelease.files).length === Object.keys(fileSums).length &&
    Object.entries(latestRelease.files).every(([relPath, sum]) => fileSums[relPath] === sum)

  const snapshotDir = join(outDir, 'snapshots', snapshotId)
  mkdirSync(join(snapshotDir, 'collections'), { recursive: true })
  const checksums = []
  for (const [relPath, content] of Object.entries(files)) {
    writeFileSync(join(snapshotDir, relPath), content, 'utf-8')
    checksums.push(`${fileSums[relPath]}  ${relPath}`)
  }

  // Counts computed directly from the corpus being published, not asserted
  // separately — a reader can recompute every one of these from the
  // collections/ files above.
  const earlyStageRated = coreCollection.filter(j => ['official', 'provisional'].includes(j.early_stage_rating?.rating_status) && j.early_stage_rating?.total != null).length
  // AJR-M ratings live in mature_rating (schema/rating.schema.json, written
  // by posi-engine's monthly rerate); a scored one is official or
  // provisional with a total_score.
  const matureRated = coreCollection.filter(j => ['official', 'provisional'].includes(j.mature_rating?.rating_status) && j.mature_rating?.total_score != null).length

  const type = isRelease ? 'official_release' : latestRelease ? 'post_release_data_snapshot' : 'pre_release_data_snapshot'
  const note = isRelease
    ? `Official release ${latestRelease.release}: its collections are byte-identical to the release manifest (releases/${latestRelease.release}/manifest.json).`
    : latestRelease
      ? `Data updated since ${latestRelease.release}; not itself a release. The current release is ${latestRelease.release}.`
      : 'Not a POSI-R release -- no POSI-R-* release has been produced yet (see posi-data/POSI-R-1.0-SPEC.md). This is a public mirror of already-committed corpus data, refreshed on demand.'

  const manifest = {
    snapshot: snapshotId,
    type,
    is_official_release: isRelease,
    release: isRelease ? latestRelease.release : null,
    latest_release: latestRelease?.release ?? null,
    note,
    generated_at: new Date().toISOString(),
    data_cutoff: isRelease ? latestRelease.data_cutoff : today,
    ...versions,
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
    // DEPRECATED (POSI-EVAL-1.0): the legacy PCI-based Citation Q archive
    // (collections/citation-rankings.json). How many Core Collection journals have a real, non-"unavailable"
    // Citation Q this run (collections/citation-rankings.json). 0 until a
    // category's real-PCI peer pool (Core Collection + Global Benchmark,
    // PJR-SPEC.md § 8) reaches MIN_CATEGORY_SIZE=20 for that journal.
    citation_q_ranked_count: rankedCount,
    pcs_q_metric_year: pcsQEdition?.metric_year ?? null,
    // DEPRECATED (POSI-EVAL-1.0): PCS-Q is not a ranking; count kept for continuity.
    pcs_q_ranked_count: pcsQEdition ? pcsQEdition.records.filter(r => r.overall_rank != null).length : 0,
    supersedes: null,
  }
  const manifestJson = JSON.stringify(manifest, null, 2) + '\n'
  writeFileSync(join(snapshotDir, 'manifest.json'), manifestJson, 'utf-8')
  checksums.push(`${sha256(manifestJson)}  manifest.json`)
  writeFileSync(join(snapshotDir, 'SHA256SUMS'), checksums.sort().join('\n') + '\n', 'utf-8')

  // Every committed release manifest is mirrored, so a cited release stays resolvable.
  for (const r of loadReleases()) {
    mkdirSync(join(outDir, 'releases', r.release), { recursive: true })
    writeFileSync(join(outDir, 'releases', r.release, 'manifest.json'), JSON.stringify(r, null, 2) + '\n', 'utf-8')
  }

  const current = {
    type,
    is_official_release: isRelease,
    release: isRelease ? latestRelease.release : null,
    latest_release: latestRelease?.release ?? null,
    latest_release_manifest: latestRelease ? `/releases/${latestRelease.release}/manifest.json` : null,
    snapshot: snapshotId,
    manifest: `/snapshots/${snapshotId}/manifest.json`,
    note: isRelease
      ? `The current data is official release ${latestRelease.release}. See manifest.json for exact provenance (data_commit/engine_commit) and per-component versions.`
      : latestRelease
        ? `Points at a data snapshot updated since release ${latestRelease.release}. See manifest.json for exact provenance.`
        : 'No POSI-R-* release exists yet -- this points at the current pre-release data snapshot, refreshed on demand rather than on a fixed schedule. See manifest.json for exact provenance (data_commit/engine_commit) and per-component versions.',
  }
  writeFileSync(join(outDir, 'current.json'), JSON.stringify(current, null, 2) + '\n', 'utf-8')

  console.log(`Wrote snapshot ${snapshotId} to ${snapshotDir}`)
  console.log(JSON.stringify(manifest, null, 2))
}

main()
