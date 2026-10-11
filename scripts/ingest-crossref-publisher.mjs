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
 * where `doaj` is a DOAJ journal id, `true` for "listed" or absent when not listed.
 * Optional: `openalex_source_id` (written to identifiers), `provenance` (a list of {source, source_record_id}; default one crossref entry),
 * `website_url` (used as the journal's home page instead of --site) and `ceased: true`
 * (the source says the journal has stopped; recorded as status_model collection_status
 * "ceased", coverage_state "inactive").
 *
 * What it does before minting anything:
 *   - ISSNs are de-duplicated and checked against the ISSN check digit; an invalid
 *     one is not an identity (Crossref repeats typos) and is dropped, and a
 *     candidate left with no valid ISSN is quarantined;
 *   - candidates that share an ISSN, in the registry or with each other, are one
 *     journal: an ISSN already in the registry means the journal has an id (a
 *     superseded id resolves to its survivor), two different ids for one
 *     candidate are a conflict for review, and fresh candidates sharing an ISSN
 *     are merged before one id is minted;
 *   - a fresh journal with the same normalised title as another fresh journal or as a
 *     record already in posi-data, but no ISSN in common, is held for review rather
 *     than minted; the ISSNs written on the records count as well as the registry keys;
 *   - open_access is true: a journal DOAJ lists is open access in DOAJ, one it does not
 *     list is open access, not in DOAJ. A ceased journal DOAJ does not list is null.
 * Quarantined, conflicting and held candidates are written to review.json in the
 * audit directory. The registry and the records are written to temporary files
 * first and then renamed; if a rename fails the other file is restored, so a failed
 * run leaves both as they were.
 *
 * Usage (from the directory holding both checkouts):
 *   node posi-data/scripts/ingest-crossref-publisher.mjs \
 *     --candidates posi-data/audits/migrations/<run>/crossref-member-311-candidates.json \
 *     --member 311 --retrieved 2026-10-10 --out wiley-expansion-2026 \
 *     --audit-dir posi-data/audits/migrations/<run> [--site 'https://onlinelibrary.wiley.com/journal/{issn}' --match wiley]
 *
 * Needs a posi-engine checkout next to posi-data (--engine; its
 * src/migration/mint.mjs does the id minting). Re-running it is safe: ISSNs
 * already in the registry resolve to their existing id and nothing is minted twice.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, rmSync, readdirSync } from 'fs'
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
const supersededFile = join(root, 'registry/superseded-ids.csv')
const outFile = join(root, 'journals/discovered', `${outName}.jsonl`)
const retrievedAt = `${retrieved}T00:00:00.000Z`

/** ISSN check digit (ISO 3297): 7 digits weighted 8..2, mod 11. */
function validIssn(s) {
  const d = s.replace('-', '')
  if (!/^\d{7}[\dX]$/.test(d)) return false
  let t = 0
  for (let i = 0; i < 7; i++) t += Number(d[i]) * (8 - i)
  const c = (11 - (t % 11)) % 11
  return d[7] === (c === 10 ? 'X' : String(c))
}
// Lower-case, accents (combining marks) removed, any other run of non-letters/digits a single space; letters and
// digits of every script are kept, so a title in Japanese or Arabic does not normalise to nothing.
const normTitle = t => (t ?? '').toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const regRows = readFileSync(registryFile, 'utf8').trim().split('\n').slice(1).map(l => {
  const [posi_id, identity_type, identity_value, first_seen] = l.split(',')
  return { posi_id, identity_type, identity_value, first_seen }
})
const registryIndex = buildRegistryIndex(regRows)

// old id -> surviving id (registry/superseded-ids.csv; its reason column holds commas, the first two do not).
const superseded = new Map()
if (existsSync(supersededFile)) {
  for (const l of readFileSync(supersededFile, 'utf8').trim().split('\n').slice(1)) {
    const [oldId, newId] = l.split(',')
    if (oldId && newId) superseded.set(oldId, newId)
  }
}
const survivor = id => superseded.get(id) ?? id

// Any ISSN of a candidate already in the registry (as an ISSN-L or as one half of a pair) means the journal has an id.
const issnToIds = new Map()
const note = (issn, id) => { const s = issnToIds.get(issn) ?? new Set(); s.add(survivor(id)); issnToIds.set(issn, s) }
for (const r of regRows) {
  if (r.identity_type === 'issn_l') note(r.identity_value, r.posi_id)
  else if (r.identity_type === 'issn_pair') for (const p of r.identity_value.split('/')) note(p, r.posi_id)
}

// The registry keys older ids on one ISSN-L (OpenAlex's), which is often not among the ISSNs Crossref lists or
// the record's own print and online ISSN. So the ISSNs written on the records count as well, or a journal
// already in posi-data is minted a second time. Records also give the titles used for the same-title check.
const existingTitles = new Map()
function readRecords(file, each) {
  if (file.endsWith('.jsonl')) { for (const l of readFileSync(file, 'utf8').split('\n')) if (l.trim()) each(JSON.parse(l)) } else each(JSON.parse(readFileSync(file, 'utf8')))
}
function walk(dir, each) {
  if (!existsSync(dir)) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) walk(f, each); else if (/\.(jsonl|json)$/.test(e.name)) readRecords(f, each)
  }
}
walk(join(root, 'journals'), j => {
  if (!j?.id || !j.identifiers || superseded.has(j.id)) return
  for (const k of ['issn_print', 'issn_online', 'issn_l']) if (j.identifiers[k]) note(j.identifiers[k], j.id)
  const t = normTitle(j.title)
  if (t) existingTitles.set(t, [...(existingTitles.get(t) ?? []), j.id])
})

const review = { quarantined: [], conflicts: [], title_overlaps: [] }
const alreadyKnown = []
let fresh = []
for (const c of candidates) {
  const all = [...new Set(c.ISSN)]
  const valid = all.filter(validIssn)
  const dropped = all.filter(i => !valid.includes(i))
  if (!valid.length) { review.quarantined.push({ title: c.title, issns: all, why: 'no ISSN with a valid check digit' }); continue }
  const ids = new Set(valid.flatMap(i => [...(issnToIds.get(i) ?? [])]))
  if (ids.size > 1) { review.conflicts.push({ title: c.title, issns: valid, posi_ids: [...ids], why: 'its ISSNs belong to different existing ids' }); continue }
  if (ids.size === 1) { alreadyKnown.push({ title: c.title, issns: valid, dropped_invalid: dropped, posi_id: [...ids][0] }); continue }
  fresh.push({ ...c, ISSN: valid, dropped_invalid: dropped })
}

// Fresh candidates that share an ISSN are one journal: merge them (the one with more ISSNs names it).
const parent = fresh.map((_, i) => i)
const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])))
const owner = new Map()
fresh.forEach((c, i) => c.ISSN.forEach(x => { if (owner.has(x)) parent[find(i)] = find(owner.get(x)); else owner.set(x, i) }))
const groups = new Map()
fresh.forEach((c, i) => { const g = find(i); groups.set(g, [...(groups.get(g) ?? []), c]) })
fresh = [...groups.values()].map(g => {
  const best = g.reduce((a, b) => (b.ISSN.length > a.ISSN.length ? b : a))
  if (g.length === 1) return best
  const types = new Map(g.flatMap(c => c['issn-type'] ?? []).map(t => [t.value, t]))
  return { ...best, ISSN: [...new Set(g.flatMap(c => c.ISSN))], 'issn-type': [...types.values()], merged: g.length, dois: Math.max(...g.map(c => c.dois ?? 0)) }
})

// Same normalised title, no ISSN in common: a continuation or a different journal; for a person to decide.
const byTitle = new Map()
for (const c of fresh) { const k = normTitle(c.title); byTitle.set(k, [...(byTitle.get(k) ?? []), c]) }
const held = new Set()
// --allow-title-overlap: a person has decided that candidates whose title equals an existing record's, with
// no ISSN in common, are different journals (e.g. a different OpenAlex source id). Overlaps among the
// candidates themselves are still held.
const allowOverlap = process.argv.includes('--allow-title-overlap')
for (const [k, g] of byTitle) {
  if (k && g.length > 1) { g.forEach(c => held.add(c)); review.title_overlaps.push({ title: g[0].title, candidates: g.map(c => ({ issns: c.ISSN, publisher: c.publisher })) }) }
}
// The same title as a record already in posi-data, but no ISSN in common (an ISSN in common would have matched above):
// a relaunch or a different journal; for a person to decide.
for (const c of fresh) {
  const ids = existingTitles.get(normTitle(c.title))
  if (ids && !held.has(c) && !allowOverlap) { held.add(c); review.title_overlaps.push({ title: c.title, candidates: [{ issns: c.ISSN, publisher: c.publisher }], existing_ids: [...new Set(ids)] }) }
}
fresh = fresh.filter(c => !held.has(c))

const entityOf = (c, n) => ({ candidate_id: String(n), issn_l: null, issn_set: [...c.ISSN].sort(), openalex_source_ids: [], representative_title: c.title })
const { assignments, newRegistryRows, unresolved } = resolveOrMintIds(fresh.map(entityOf), registryIndex, nextSequenceNumber(regRows), retrieved)
if (unresolved.length) throw new Error(`${unresolved.length} candidates have no usable ISSN`)

const existingIds = new Set(existsSync(outFile) ? readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id) : [])
const lines = [], mapping = ['posi_id,title,issn_print,issn_online,publisher,open_access,minted']
fresh.forEach((c, n) => {
  const a = assignments[n]
  if (existingIds.has(a.posi_id)) return
  const t = (c['issn-type'] ?? []).filter(x => c.ISSN.includes(x.value))
  const online = t.find(x => x.type === 'electronic')?.value ?? null
  const print = t.find(x => x.type === 'print')?.value ?? null
  const main = online ?? print ?? c.ISSN[0]
  const ours = !match || match.test(c.publisher ?? '')
  const doajId = typeof c.doaj === 'string' ? c.doaj : null
  const openAccess = c.doaj || !c.ceased ? true : null
  lines.push(JSON.stringify({
    id: a.posi_id, title: c.title, short_title: c.title, status: 'discovered',
    publisher: c.publisher ?? null, country: null, language: null,
    open_access: openAccess, license: null,
    website_url: c.website_url ?? (ours && site ? site.replace('{issn}', main.replace('-', '')) : null),
    identifiers: { issn_l: null, issn_print: print, issn_online: online ?? (print ? null : c.ISSN[0]), openalex_source_id: c.openalex_source_id ?? null, crossref_member_id: /^\d+$/.test(member ?? '') ? member : null, ror_publisher_id: null, doaj_id: doajId },
    classification: null, coverage: null, selection: null,
    ...(c.ceased ? { status_model: { collection_status: 'ceased', coverage_state: 'inactive' } } : {}),
    provenance: (c.provenance ?? [{ source: 'crossref', source_record_id: main }])
      .concat(c.doaj ? [{ source: 'doaj', source_record_id: doajId }] : [])
      .map(p => ({ source: p.source, source_record_id: p.source_record_id ?? null, retrieved_at: retrievedAt, license: null })),
    created_at: retrievedAt, updated_at: retrievedAt,
  }))
  mapping.push([a.posi_id, JSON.stringify(c.title), print ?? '', online ?? '', JSON.stringify(c.publisher ?? ''), openAccess ?? 'unknown', a.minted].join(','))
})

// Both files are written aside first. If a rename then fails, the files already renamed are put back as they were,
// so the registry cannot be left with ids that have no records (a rerun would treat those ISSNs as already known).
const tmp = f => `${f}.tmp-${process.pid}`
const prior = existsSync(outFile) ? readFileSync(outFile, 'utf8') : ''
const writes = []
if (newRegistryRows.length) {
  const text = readFileSync(registryFile, 'utf8')
  writes.push([registryFile, text, (text.endsWith('\n') ? text : text + '\n') + newRegistryRows.map(r => `${r.posi_id},${r.identity_type},${r.identity_value},${r.first_seen}`).join('\n') + '\n'])
}
if (lines.length) writes.push([outFile, existsSync(outFile) ? prior : null, prior + lines.join('\n') + '\n'])
const done = []
try {
  for (const [f, , text] of writes) writeFileSync(tmp(f), text)
  for (const w of writes) { renameSync(tmp(w[0]), w[0]); done.push(w) }
} catch (e) {
  for (const [f, before] of done.reverse()) { if (before === null) rmSync(f, { force: true }); else writeFileSync(f, before) }
  throw e
} finally {
  for (const [f] of writes) rmSync(tmp(f), { force: true })
}

const summary = {
  candidates: candidates.length, already_in_registry: alreadyKnown.length, new_records: lines.length, ids_minted: newRegistryRows.length,
  merged_candidates: fresh.filter(c => c.merged).length, held_for_review: review.title_overlaps.length, conflicts: review.conflicts.length, quarantined: review.quarantined.length,
  registry_rows_after: regRows.length + newRegistryRows.length,
}
// A re-run finds everything already in the registry; it must not overwrite the first run's audit files with empty ones.
if (lines.length || review.quarantined.length || review.conflicts.length || review.title_overlaps.length) {
  mkdirSync(auditDir, { recursive: true })
  if (lines.length) {
    writeFileSync(join(auditDir, 'new-journals-mapping.csv'), mapping.join('\n') + '\n')
    writeFileSync(join(auditDir, 'already-in-registry.json'), JSON.stringify(alreadyKnown, null, 1) + '\n')
    writeFileSync(join(auditDir, 'manifest.json'), JSON.stringify({ source: `Crossref member ${member}`, retrieved, ...summary }, null, 1) + '\n')
  }
  writeFileSync(join(auditDir, 'review.json'), JSON.stringify(review, null, 1) + '\n')
}
console.log(JSON.stringify(summary))
