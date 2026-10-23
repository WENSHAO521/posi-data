#!/usr/bin/env node
/**
 * apply-issn-queue-decisions.mjs
 *
 * Applies the owner's decisions (2026-10-23, website issue #102, checked again by the owner against the ISSN
 * Portal and publishers the same day) on the nine rows of
 * audits/data-quality/issn-integrity/open-issues.csv: corrects the ISSNs and other attributes listed in
 * DECISIONS, supersedes the second id of the four journals minted twice (registry/superseded-ids.csv; ids
 * are never reassigned), moves a superseded id's screening record into the survivor's journal_code_aliases, and
 * removes the rows from the queue. The evidence for each row is in the issue.
 *
 * A record in journals/core is edited there, a record in journals/discovered in its .jsonl; the record's copy
 * in corpus/global-benchmark.json (matched by posi_id) gets the same ISSNs, so the two stay in step. A
 * record whose current values differ from DECISIONS' `from` is left alone and reported (someone changed it).
 * Every changed record gets a posi_curation provenance entry and a new updated_at. Dry run unless --write.
 *
 *   node scripts/apply-issn-queue-decisions.mjs [--write]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WRITE = process.argv.includes('--write')
const NOW = new Date().toISOString()
const DATE = NOW.slice(0, 10)
const SOURCE = 'github:WENSHAO521/Panorama-Open-Scholarly-Index#102'
const checkOk = (v) => { const d = String(v).replace('-', ''); if (!/^\d{7}[\dX]$/.test(d)) return false; let t = 0; for (let i = 0; i < 7; i++) t += (8 - i) * Number(d[i]); const c = (11 - (t % 11)) % 11; return d[7] === (c === 10 ? 'X' : String(c)) }

// set: identifiers.* or top-level fields; from: the values expected now (guards against a concurrent edit).
const DECISIONS = [
  { id: 'POSI-J-002944', issn: '2428-4881', from: { issn_print: '2428-4881', issn_online: '1405-9193' },
    set: { issn_print: '1405-9193', issn_online: '2448-4881', publisher: 'Universidad Nacional Autónoma de México, Instituto de Investigaciones Jurídicas' } },
  { id: 'POSI-J-003175', issn: '1234-988X', from: { issn_print: '1234-988X', issn_online: '1049-8931' },
    set: { issn_print: '1049-8931', issn_online: '1557-0657' } },
  { id: 'POSI-J-008308', issn: '1728-5303', from: { issn_print: '1728-5303', issn_online: '1728-4414' },
    set: { issn_print: '1728-4414', issn_online: '1728-5305' } },
  { id: 'POSI-J-013785', issn: '1806-9652', from: { issn_online: '1806-9652' },
    set: { issn_online: '2178-0579' } },
  // The live record is journals/core/87/POSI-J-000143.json, already right; its stale copy in journals/discovered
  // still carries Environmental Engineering's ISSN and website, which the validator reads.
  { id: 'POSI-J-000143', issn: '2813-5067', where: 'discovered', from: { issn_online: '2813-5067' },
    set: { issn_online: '2296-665X', website_url: 'https://www.frontiersin.org/journals/environmental-science' } },
  { id: 'POSI-J-023668', issn: '0304-4238', from: { issn_print: null, issn_online: '0304-4238' },
    set: { issn_print: '0304-4238', issn_online: '1879-1018' },
    supersede: { old: 'POSI-J-000605', reason: 'Duplicate: Scientia Horticulturae minted twice (same title and publisher, shared ISSN 0304-4238); the survivor is the core and benchmark record. Print/online ISSNs set from Elsevier (website issue #102).' } },
  { id: 'POSI-J-024439', issn: '1049-9644', from: { issn_print: null, issn_online: '1049-9644' },
    set: { issn_l: '1049-9644', issn_print: '1049-9644', issn_online: '1090-2112' },
    supersede: { old: 'POSI-J-000899', reason: 'Duplicate: Biological Control minted twice (same title and publisher, shared ISSN 1049-9644); the survivor is the benchmark record (website issue #102).' } },
  { id: 'POSI-J-025089', issn: '1998-9563', from: { issn_print: null, issn_online: '1998-9563' },
    set: { issn_l: '1998-9563', issn_print: '1998-9563', issn_online: '2224-7955', publisher: 'IWA Publishing', website_url: 'https://iwaponline.com/hr' },
    supersede: { old: 'POSI-J-001689', reason: 'Duplicate: Hydrology Research minted twice (same title, OpenAlex source S4210238655, shared ISSN 1998-9563); the survivor is the benchmark record. Owned by IWA Publishing and the Nordic Association for Hydrology; from 2026 Elsevier provides publishing services (ScienceDirect), so iwaponline.com/hr is kept as the journal home page (website issue #102).' } },
  { id: 'POSI-J-024548', issn: '2325-4262', from: { issn_print: null, issn_online: '2325-4262' },
    set: { issn_l: '2325-4262', issn_print: '2096-9589', issn_online: '2325-4262' },
    supersede: { old: 'POSI-J-003672', reason: 'Duplicate: Chinese Journal of Population, Resources and Environment minted twice (same title, OpenAlex source S4210190789, shared ISSN 2325-4262); the survivor is the benchmark record. Print 2096-9589 and online 2325-4262 per KeAi and the ISSN Portal. 1004-2857, carried by the superseded record, is a separately registered ISSN (key title China Population, Resources & Environment (Ji’nan)) that Taylor & Francis still lists for this journal; it is not taken over, see audits/data-quality/issn-integrity/notes-2026-10-23.md (website issue #102).' } },
]
const ID_FIELDS = new Set(['issn_l', 'issn_print', 'issn_online'])

// Where each record lives: journals/core/<xx>/<id>.json wins over a journals/discovered line (as loadJournalRecords).
const coreFile = new Map()
for (const d of readdirSync(join(ROOT, 'journals/core'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) for (const f of readdirSync(join(ROOT, 'journals/core', d))) if (f.endsWith('.json')) coreFile.set(f.slice(0, -5), join(ROOT, 'journals/core', d, f))
const discDir = join(ROOT, 'journals/discovered')
const disc = new Map(readdirSync(discDir).filter((f) => f.endsWith('.jsonl')).map((f) => [f, readFileSync(join(discDir, f), 'utf8').split('\n')]))
const discAt = new Map()
for (const [f, lines] of disc) lines.forEach((l, i) => { if (l.trim()) discAt.set(JSON.parse(l).id, [f, i]) })
const benchPath = join(ROOT, 'corpus/global-benchmark.json')
const bench = JSON.parse(readFileSync(benchPath, 'utf8'))
const benchById = new Map(bench.filter((j) => j.posi_id).map((j) => [j.posi_id, j]))

const get = (r, k) => (ID_FIELDS.has(k) ? r.identifiers[k] : r[k]) ?? null
const changed = { core: new Set(), disc: new Set(), bench: false }
const done = [], skipped = []
for (const d of DECISIONS) {
  for (const v of Object.values(d.set)) if (typeof v === 'string' && /^\d{4}-\d{3}[\dX]$/.test(v) && !checkOk(v)) throw new Error(`${d.id}: ${v} fails its check digit`)
  const where = d.where === 'discovered' ? discAt.get(d.id) : coreFile.get(d.id) ?? discAt.get(d.id)
  if (!where) { skipped.push(`${d.id}: record not found`); continue }
  const rec = typeof where === 'string' ? JSON.parse(readFileSync(where, 'utf8')) : JSON.parse(disc.get(where[0])[where[1]])
  const off = Object.entries(d.from).filter(([k, v]) => get(rec, k) !== v)
  if (off.length) { skipped.push(`${d.id}: ${off.map(([k, v]) => `${k} is ${get(rec, k)}, expected ${v}`).join('; ')}`); continue }
  const b = d.where === 'discovered' ? null : benchById.get(d.id)
  const benchInStep = b && ['issn_print', 'issn_online'].every((k) => (b[k] ?? null) === (rec.identifiers[k] ?? null))
  for (const [k, v] of Object.entries(d.set)) if (ID_FIELDS.has(k)) rec.identifiers[k] = v; else rec[k] = v
  rec.provenance.push({ source: 'posi_curation', source_record_id: SOURCE, retrieved_at: NOW, license: null })
  rec.updated_at = NOW
  if (typeof where === 'string') { changed.core.add(where); if (WRITE) writeFileSync(where, JSON.stringify(rec, null, 2) + '\n', 'utf8') }
  else { disc.get(where[0])[where[1]] = JSON.stringify(rec); changed.disc.add(where[0]) }
  if (benchInStep) {
    b.issn_print = rec.identifiers.issn_print; b.issn_online = rec.identifiers.issn_online
    for (const k of ['publisher', 'website_url']) if (k in d.set) b[k] = d.set[k]
    b.updated_at = NOW; changed.bench = true
  } else if (b) skipped.push(`${d.id}: corpus/global-benchmark.json copy not in step with the record; corpus left unchanged`)
  done.push(d)
}

const supPath = join(ROOT, 'registry/superseded-ids.csv')
const supText = readFileSync(supPath, 'utf8')
const csv = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
const newSup = done.filter((d) => d.supersede && !supText.includes(`\n${d.supersede.old},`)).map((d) => [d.supersede.old, d.id, csv(d.supersede.reason), DATE].join(','))

const queuePath = join(ROOT, 'audits/data-quality/issn-integrity/open-issues.csv')
const queue = readFileSync(queuePath, 'utf8').split('\n')
const doneIssn = new Set(done.map((d) => d.issn))
const keep = queue.filter((l, i) => i === 0 || !l.trim() || !doneIssn.has(l.split(',')[1]))

// A superseded id keeps no screening record of its own: compose-discovered needs a live journal for each one. Its
// website code (and aliases) move to the survivor's journal_code_aliases, so the old journal page redirects.
const screenPath = join(ROOT, 'screening/discovered-screening.jsonl')
const screening = readFileSync(screenPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const screenById = new Map(screening.map((x) => [x.posi_id, x]))
const dropped = new Set()
for (const d of DECISIONS) {
  if (!d.supersede) continue
  const old = screenById.get(d.supersede.old), live = screenById.get(d.id)
  if (!old) continue
  if (!live) { skipped.push(`${d.id}: no screening record to take ${d.supersede.old}'s code ${old.journal_code}`); continue }
  const { posi_id, journal_code, journal_code_aliases, ...rest } = live
  const aliases = [...new Set([...(journal_code_aliases ?? []), old.journal_code, ...(old.journal_code_aliases ?? [])])].filter((c) => c !== journal_code).sort()
  Object.keys(live).forEach((k) => delete live[k])
  Object.assign(live, { posi_id, journal_code, journal_code_aliases: aliases, ...rest, updated_at: NOW })
  dropped.add(d.supersede.old)
}

if (WRITE) {
  if (dropped.size) writeFileSync(screenPath, screening.filter((x) => !dropped.has(x.posi_id)).map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8')
  for (const f of changed.disc) writeFileSync(join(discDir, f), disc.get(f).join('\n'), 'utf8')
  if (changed.bench) writeFileSync(benchPath, JSON.stringify(bench, null, 2) + '\n', 'utf8')
  if (newSup.length) writeFileSync(supPath, supText.replace(/\n?$/, '\n') + newSup.join('\n') + '\n', 'utf8')
  writeFileSync(queuePath, keep.join('\n'), 'utf8')
}
console.log(WRITE ? 'written' : 'dry run', { applied: done.length, superseded: newSup.length, queue_rows_removed: queue.length - keep.length, benchmark_changed: changed.bench, screening_merged: [...dropped] })
for (const s of skipped) console.log('  ' + s)
