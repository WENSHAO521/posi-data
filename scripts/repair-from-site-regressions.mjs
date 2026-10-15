#!/usr/bin/env node
/**
 * repair-from-site-regressions.mjs
 *
 * Carries the website's country corrections and Crossref-verified ISSN pairs into
 * journals/discovered/*.jsonl (audits/data-quality/site-regression-repair-2026-10-15).
 * Dry run unless --write. Records in journals/core are never touched (the corpus keeps its own copy).
 *
 *  1. Country. Where the record has no country and the website's record for it has one, the ISO code is
 *     filled in. The website value "VRA" is not a country: it is replaced by the most common country of
 *     the same publisher's other records (reported, not silent).
 *  2. ISSN pair. issn-resolved.json lists records whose print and electronic ISSN were both read from
 *     Crossref under the same title. issn_print and issn_online are set to that pair; issn_l is kept.
 *     A pair is skipped when either ISSN fails its check digit or is already held by another record,
 *     so the repair cannot create an invalid ISSN or a new shared one.
 *
 * Every changed record gets a posi_curation provenance entry and a new updated_at.
 *
 *   node scripts/repair-from-site-regressions.mjs --site <discovered-journals.json> --countries <country-codes.mjs> [--write]
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIT = join(ROOT, 'audits/data-quality/site-regression-repair-2026-10-15')
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null }
const WRITE = process.argv.includes('--write')
if (!arg('site') || !arg('countries')) { console.error('usage: --site <json> --countries <country-codes.mjs> [--write]'); process.exit(2) }

const { isoToCountry } = await import(pathToFileURL(resolve(arg('countries'))).href)
const nameToIso = new Map()
for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') for (const b of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  const n = isoToCountry(a + b)
  if (n && n !== a + b) nameToIso.set(n, a + b)
}
const site = JSON.parse(readFileSync(arg('site'), 'utf8'))
const siteById = new Map(site.map((s) => [s.id, s]))
const codeOf = new Map()
for (const l of readFileSync(join(ROOT, 'screening/discovered-screening.jsonl'), 'utf8').split('\n')) if (l.trim()) { const s = JSON.parse(l); codeOf.set(s.posi_id, s.journal_code) }
const checkOk = (v) => { const d = String(v).replace('-', ''); if (!/^\d{7}[\dX]$/.test(d)) return false; let t = 0; for (let i = 0; i < 7; i++) t += (8 - i) * Number(d[i]); const c = (11 - (t % 11)) % 11; return d[7] === (c === 10 ? 'X' : String(c)) }
const issn = new Map(JSON.parse(readFileSync(join(AUDIT, 'issn-resolved.json'), 'utf8')).map((x) => [x.posi_id, x]))

const dir = join(ROOT, 'journals/discovered')
const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
const parsed = new Map(files.map((f) => [f, readFileSync(join(dir, f), 'utf8').split('\n')]))

// Most common country per publisher, from records that already have one.
const tally = new Map()
for (const lines of parsed.values()) for (const l of lines) if (l.trim()) {
  const r = JSON.parse(l); if (!r.country || !r.publisher) continue
  const t = tally.get(r.publisher) ?? tally.set(r.publisher, new Map()).get(r.publisher)
  t.set(r.country, (t.get(r.country) ?? 0) + 1)
}
const modeCountry = (p) => { const t = tally.get(p); return t ? [...t].sort((a, b) => b[1] - a[1])[0][0] : null }

// ISSNs held by each record (superseded ids excluded), to refuse a pair another record already holds.
const { loadJournalRecords } = await import('./lib/journal-records.mjs')
const holders = new Map()
for (const r of loadJournalRecords(ROOT).values()) for (const v of Object.values(r.identifiers ?? {})) if (/^\d{4}-\d{3}[\dX]$/.test(v ?? '')) (holders.get(v) ?? holders.set(v, new Set()).get(v)).add(r.id)
const pairUsable = (p) => [p.issn_print, p.issn_online].every((v) => checkOk(v) && [...(holders.get(v) ?? [])].every((h) => h === p.posi_id))

const NOW = new Date().toISOString()
const stats = { country_filled: 0, country_from_publisher: 0, country_unresolved: 0, issn_pair_set: 0, issn_pair_skipped: 0, unchanged: 0 }
const notes = []
for (const f of files) {
  let changed = false
  const out = parsed.get(f).map((line) => {
    if (!line.trim()) return line
    const r = JSON.parse(line)
    const s = siteById.get(`j-disc-${codeOf.get(r.id)}`)
    let touched = false
    if (!r.country && s?.country) {
      let c = s.country === 'VRA' ? null : nameToIso.get(s.country) ?? null
      if (c) stats.country_filled++
      else if (s.country === 'VRA' && (c = modeCountry(r.publisher))) { stats.country_from_publisher++; notes.push(`${r.id}: website country "VRA" -> ${c} (most common for ${r.publisher})`) }
      else { stats.country_unresolved++; notes.push(`${r.id}: country "${s.country}" has no ISO code; left empty`) }
      if (c) { r.country = c; touched = true }
    }
    const p = issn.get(r.id)
    if (p && !pairUsable(p)) { stats.issn_pair_skipped++; notes.push(`${r.id}: Crossref pair ${p.issn_print}/${p.issn_online} fails a check digit or is held by another record; left unchanged`) }
    else if (p) {
      const x = (r.identifiers ??= {})
      if (x.issn_print !== p.issn_print || x.issn_online !== p.issn_online) { x.issn_print = p.issn_print; x.issn_online = p.issn_online; stats.issn_pair_set++; touched = true }
    }
    if (!touched) { stats.unchanged++; return line }
    r.provenance.push({ source: 'posi_curation', source_record_id: s?.id ?? `crossref:${p?.crossref_lookup}`, retrieved_at: NOW, license: null })
    r.updated_at = NOW
    changed = true
    return JSON.stringify(r)
  })
  if (changed && WRITE) writeFileSync(join(dir, f), out.join('\n'), 'utf8')
}
console.log(WRITE ? 'written' : 'dry run', stats)
for (const n of notes) console.log(n)
