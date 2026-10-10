#!/usr/bin/env node
/**
 * ingest-crossref-publisher.mjs
 *
 * Adds journals found in a Crossref member's journal articles to the registry
 * and to journals/discovered/<out>.jsonl, following registry/README.md:
 * identity is resolved against registry/journal-id-map.csv first, and only a
 * journal none of whose ISSNs is already known gets a new POSI-J id.
 *
 * Input is a JSON array of candidates:
 *   { title, publisher, ISSN: [..], 'issn-type': [{value,type}], dois, subjects, doaj }
 *
 * Usage (from the directory holding both checkouts):
 *   node posi-data/scripts/ingest-crossref-publisher.mjs \
 *     --candidates posi-data/audits/migrations/<run>/crossref-member-311-candidates.json \
 *     --member 311 --retrieved 2026-10-10 --out wiley-expansion-2026 \
 *     --audit-dir posi-data/audits/migrations/<run> [--site 'https://onlinelibrary.wiley.com/journal/{issn}' --match wiley]
 *
 * Needs a posi-engine checkout next to posi-data (its src/migration/mint.mjs
 * does the id minting). Re-running it is safe: ISSNs already in the registry
 * resolve to their existing id and nothing is minted twice.
 */
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 ? process.argv[i + 1] : d }
const root = resolve(arg('data', 'posi-data'))
const engine = resolve(arg('engine', 'posi-engine'))
const { buildRegistryIndex, nextSequenceNumber, resolveOrMintIds } = await import(pathToFileURL(join(engine, 'src/migration/mint.mjs')).href)

const candidates = JSON.parse(readFileSync(resolve(arg('candidates')), 'utf8'))
const member = arg('member')
const retrieved = arg('retrieved')
const outName = arg('out')
const auditDir = resolve(arg('audit-dir'))
const site = arg('site')
const match = arg('match') ? new RegExp(arg('match'), 'i') : null
const registryFile = join(root, 'registry/journal-id-map.csv')
const outFile = join(root, 'journals/discovered', `${outName}.jsonl`)
const retrievedAt = `${retrieved}T00:00:00.000Z`

const regRows = readFileSync(registryFile, 'utf8').trim().split('\n').slice(1).map(l => {
  const [posi_id, identity_type, identity_value, first_seen] = l.split(',')
  return { posi_id, identity_type, identity_value, first_seen }
})
const registryIndex = buildRegistryIndex(regRows)

// Any ISSN of a candidate already known to the registry (as an ISSN-L or as one half of a pair) means the
// journal already has an id; it is reported, not minted again.
const issnToId = new Map()
for (const r of regRows) {
  if (r.identity_type === 'issn_l') issnToId.set(r.identity_value, r.posi_id)
  else if (r.identity_type === 'issn_pair') for (const p of r.identity_value.split('/')) issnToId.set(p, r.posi_id)
}
const alreadyKnown = [], fresh = []
for (const c of candidates) {
  const hit = c.ISSN.map(i => issnToId.get(i)).find(Boolean)
  if (hit) alreadyKnown.push({ title: c.title, issns: c.ISSN, posi_id: hit })
  else fresh.push(c)
}

const entityOf = (c, n) => ({ candidate_id: String(n), issn_l: null, issn_set: [...new Set(c.ISSN)].sort(), openalex_source_ids: [], representative_title: c.title })
const entities = fresh.map(entityOf)
const { assignments, newRegistryRows, unresolved } = resolveOrMintIds(entities, registryIndex, nextSequenceNumber(regRows), retrieved)
if (unresolved.length) throw new Error(`${unresolved.length} candidates have no usable ISSN`)

const existingIds = new Set(existsSync(outFile) ? readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id) : [])
const lines = [], mapping = ['posi_id,title,issn_print,issn_online,publisher,open_access,minted']
fresh.forEach((c, n) => {
  const a = assignments[n]
  if (existingIds.has(a.posi_id)) return
  const t = c['issn-type'] ?? []
  const online = t.find(x => x.type === 'electronic')?.value ?? null
  const print = t.find(x => x.type === 'print')?.value ?? null
  const main = online ?? print ?? c.ISSN[0]
  const ours = !match || match.test(c.publisher ?? '')
  lines.push(JSON.stringify({
    id: a.posi_id, title: c.title, short_title: c.title, status: 'discovered',
    publisher: c.publisher ?? null, country: null, language: null,
    open_access: !!c.doaj, license: null,
    website_url: ours && site ? site.replace('{issn}', main.replace('-', '')) : null,
    identifiers: { issn_l: null, issn_print: print, issn_online: online, openalex_source_id: null, crossref_member_id: member, ror_publisher_id: null, doaj_id: null },
    classification: null, coverage: null, selection: null,
    provenance: [{ source: 'crossref', source_record_id: main, retrieved_at: retrievedAt, license: null }].concat(c.doaj ? [{ source: 'doaj', source_record_id: null, retrieved_at: retrievedAt, license: null }] : []),
    created_at: retrievedAt, updated_at: retrievedAt,
  }))
  mapping.push([a.posi_id, JSON.stringify(c.title), print ?? '', online ?? '', JSON.stringify(c.publisher ?? ''), !!c.doaj, a.minted].join(','))
})

if (newRegistryRows.length) appendFileSync(registryFile, newRegistryRows.map(r => `${r.posi_id},${r.identity_type},${r.identity_value},${r.first_seen}`).join('\n') + '\n')
if (lines.length) appendFileSync(outFile, lines.join('\n') + '\n')
const summary = { candidates: candidates.length, already_in_registry: alreadyKnown.length, new_records: lines.length, ids_minted: newRegistryRows.length, registry_rows_after: regRows.length + newRegistryRows.length }
// A re-run finds everything already in the registry; it must not overwrite the first run's audit files with empty ones.
if (lines.length) {
  mkdirSync(auditDir, { recursive: true })
  writeFileSync(join(auditDir, 'new-journals-mapping.csv'), mapping.join('\n') + '\n')
  writeFileSync(join(auditDir, 'already-in-registry.json'), JSON.stringify(alreadyKnown, null, 1) + '\n')
  writeFileSync(join(auditDir, 'manifest.json'), JSON.stringify({ source: `Crossref member ${member}`, retrieved: retrieved, ...summary }, null, 1) + '\n')
}
console.log(JSON.stringify(summary))
