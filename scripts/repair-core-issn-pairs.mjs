#!/usr/bin/env node
/**
 * repair-core-issn-pairs.mjs
 *
 * Sets the print and electronic ISSN of journals/core records from the Crossref-verified pairs in
 * audits/data-quality/site-regression-repair-2026-10-15/issn-resolved.json, and the same two fields of the
 * record's copy in corpus/global-benchmark.json, so the two stay in step (a journals/discovered record with
 * the same id is ignored by loadJournalRecords, which is why repair-from-site-regressions.mjs could not do
 * this). Dry run unless --write.
 *
 * A pair is skipped when either ISSN fails its check digit or is held by another record, or when the
 * record's current ISSNs differ between journals/core and the corpus (someone changed one side).
 * issn_l is not changed. Each changed core record gets a posi_curation provenance entry and a new updated_at;
 * the corpus record gets a new updated_at.
 *
 *   node scripts/repair-core-issn-pairs.mjs [--write]
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadJournalRecords } from './lib/journal-records.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIT = join(ROOT, 'audits/data-quality/site-regression-repair-2026-10-15')
const WRITE = process.argv.includes('--write')
const NOW = new Date().toISOString()

const checkOk = (v) => { const d = String(v).replace('-', ''); if (!/^\d{7}[\dX]$/.test(d)) return false; let t = 0; for (let i = 0; i < 7; i++) t += (8 - i) * Number(d[i]); const c = (11 - (t % 11)) % 11; return d[7] === (c === 10 ? 'X' : String(c)) }

const holders = new Map()
for (const r of loadJournalRecords(ROOT).values()) for (const v of Object.values(r.identifiers ?? {})) if (/^\d{4}-\d{3}[\dX]$/.test(v ?? '')) (holders.get(v) ?? holders.set(v, new Set()).get(v)).add(r.id)

const coreFile = new Map()
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) coreFile.set(e.name.replace('.json', ''), p) } }
walk(join(ROOT, 'journals/core'))

const benchPath = join(ROOT, 'corpus/global-benchmark.json')
const bench = JSON.parse(readFileSync(benchPath, 'utf8'))
const benchById = new Map(bench.map((j) => [j.posi_id, j]))

const stats = { set: 0, already: 0, skipped: 0, not_core: 0 }
const notes = []
for (const p of JSON.parse(readFileSync(join(AUDIT, 'issn-resolved.json'), 'utf8'))) {
  const file = coreFile.get(p.posi_id)
  if (!file) { stats.not_core++; continue }
  const rec = JSON.parse(readFileSync(file, 'utf8'))
  const b = benchById.get(p.posi_id)
  const x = rec.identifiers
  if (x.issn_print === p.issn_print && x.issn_online === p.issn_online && b && b.issn_print === p.issn_print && b.issn_online === p.issn_online) { stats.already++; continue }
  if (![p.issn_print, p.issn_online].every((v) => checkOk(v) && [...(holders.get(v) ?? [])].every((h) => h === p.posi_id))) { stats.skipped++; notes.push(`${p.posi_id} ${p.title}: ${p.issn_print}/${p.issn_online} fails a check digit or is held by another record; left unchanged`); continue }
  if (!b || b.issn_print !== (x.issn_print ?? null) || b.issn_online !== (x.issn_online ?? null)) { stats.skipped++; notes.push(`${p.posi_id} ${p.title}: journals/core and the corpus disagree on the current ISSNs; left unchanged`); continue }
  x.issn_print = p.issn_print; x.issn_online = p.issn_online
  rec.provenance.push({ source: 'posi_curation', source_record_id: `crossref:${p.crossref_lookup}`, retrieved_at: NOW, license: null })
  rec.updated_at = NOW
  b.issn_print = p.issn_print; b.issn_online = p.issn_online; b.updated_at = NOW
  stats.set++
  if (WRITE) writeFileSync(file, JSON.stringify(rec, null, 2) + '\n', 'utf8')
}
if (WRITE && stats.set) writeFileSync(benchPath, JSON.stringify(bench, null, 2) + '\n', 'utf8')
console.log(WRITE ? 'written' : 'dry run', stats)
for (const n of notes) console.log(n)
