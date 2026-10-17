#!/usr/bin/env node
/**
 * repair-marc-countries.mjs
 *
 * Some journals/discovered records hold a MARC country code (from ISSN / library records) where an ISO 3166
 * alpha-2 code belongs. Several MARC codes are also ISO codes of other countries, so the published collection
 * shows Indonesia (MARC IO) as British Indian Ocean Territory, Argentina (AG) as Antigua, Brazil (BL) as
 * St Barthelemy, and so on (migration plan, "which side wins", country).
 *
 * The website decided the scheme per code (scripts/lib/country-codes.mjs, MARC2). A record is repaired only when
 * its code is a MARC2 key AND the website's country name for the same journal equals that code's MARC meaning:
 * both sides then agree on the journal's country and only the code's scheme was wrong. The code is replaced by the
 * ISO code of that country. Anything else is left alone and listed. Records in journals/core are never touched.
 * Every changed record gets a posi_curation provenance entry and a new updated_at. Dry run unless --write.
 *
 *   node scripts/repair-marc-countries.mjs --site <discovered-journals.json> --countries <country-codes.mjs> [--write]
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null }
const WRITE = process.argv.includes('--write')
if (!arg('site') || !arg('countries')) { console.error('usage: --site <json> --countries <country-codes.mjs> [--write]'); process.exit(2) }

const { isoToCountry, MARC2 } = await import(pathToFileURL(resolve(arg('countries'))).href)
const nameToIso = new Map()
for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') for (const b of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  if (a + b in MARC2) continue // a MARC-only reading must not win the name lookup
  const n = isoToCountry(a + b)
  if (n && n !== a + b) nameToIso.set(n, a + b)
}
const site = JSON.parse(readFileSync(arg('site'), 'utf8'))
const siteById = new Map(site.map((s) => [s.id, s]))
const codeOf = new Map()
for (const l of readFileSync(join(ROOT, 'screening/discovered-screening.jsonl'), 'utf8').split('\n')) if (l.trim()) { const s = JSON.parse(l); codeOf.set(s.posi_id, s.journal_code) }

const coreIds = new Set()
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) coreIds.add(e.name.replace('.json', '')) } }
walk(join(ROOT, 'journals/core'))

const NOW = new Date().toISOString()
const stats = { repaired: 0, skipped_core: 0, skipped_site_disagrees: 0, skipped_no_site: 0, unchanged: 0 }
const byCode = {}
const notes = []
const dir = join(ROOT, 'journals/discovered')
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
  let changed = false
  const out = readFileSync(join(dir, f), 'utf8').split('\n').map((line) => {
    if (!line.trim()) return line
    const r = JSON.parse(line)
    if (!(r.country in MARC2)) { stats.unchanged++; return line }
    if (coreIds.has(r.id)) { stats.skipped_core++; notes.push(`${r.id}: core record holds ${r.country}; not touched`); return line }
    const s = siteById.get(`j-disc-${codeOf.get(r.id)}`)
    if (!s) { stats.skipped_no_site++; notes.push(`${r.id}: ${r.country} has no website record to confirm it`); return line }
    const iso = s.country === MARC2[r.country] ? nameToIso.get(s.country) : null
    if (!iso) { stats.skipped_site_disagrees++; notes.push(`${r.id}: ${r.country} (${MARC2[r.country]}) but the website says "${s.country}"; left unchanged`); return line }
    byCode[`${r.country} -> ${iso}`] = (byCode[`${r.country} -> ${iso}`] ?? 0) + 1
    r.country = iso
    r.provenance.push({ source: 'posi_curation', source_record_id: s.id, retrieved_at: NOW, license: null })
    r.updated_at = NOW
    stats.repaired++
    changed = true
    return JSON.stringify(r)
  })
  if (changed && WRITE) writeFileSync(join(dir, f), out.join('\n'), 'utf8')
}
console.log(WRITE ? 'written' : 'dry run', stats, byCode)
for (const n of notes) console.log(n)
