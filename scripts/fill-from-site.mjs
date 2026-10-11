#!/usr/bin/env node
/**
 * fill-from-site.mjs
 *
 * Fills empty fields of journals/discovered records from the website's record for the same journal
 * (the pairing is screening/discovered-screening.jsonl: POSI id <-> website journal_code). Only a
 * null or empty field is filled, and only these: country (as an ISO code), openalex_source_id (not
 * held by another record) and website_url. A value that is set is never changed. Dry run unless --write;
 * safe to re-run. journals/core is not touched.
 *
 *   node scripts/fill-from-site.mjs --site <discovered-journals.json> --countries <country-codes.mjs> [--write]
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null }
const WRITE = process.argv.includes('--write')
if (!arg('site') || !arg('countries')) { console.error('usage: --site <json> --countries <country-codes.mjs> [--write]'); process.exit(2) }
const { isoToCountry } = await import(pathToFileURL(resolve(arg('countries'))).href)
const nameToIso = new Map()
for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') for (const b of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') { const n = isoToCountry(a + b); if (n && n !== a + b) nameToIso.set(n, a + b) }

const siteByCode = new Map(JSON.parse(readFileSync(arg('site'), 'utf8')).map((s) => [s.journal_code, s]))
const codeOf = new Map(readFileSync('screening/discovered-screening.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => { const s = JSON.parse(l); return [s.posi_id, s.journal_code] }))

// OpenAlex ids already used by any journal record, so a fill cannot give one id to two journals.
const oaOwner = new Map()
const note = (r) => { const o = r.identifiers?.openalex_source_id; if (o) oaOwner.set(o, [...(oaOwner.get(o) ?? []), r.id]) }
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) note(JSON.parse(readFileSync(p, 'utf8'))) } }
walk('journals/core')
const files = readdirSync('journals/discovered').filter((f) => f.endsWith('.jsonl'))
for (const f of files) for (const l of readFileSync(join('journals/discovered', f), 'utf8').split('\n')) if (l.trim()) note(JSON.parse(l))

const NOW = new Date().toISOString()
const stats = { country: 0, openalex_source_id: 0, website_url: 0, records: 0, openalex_skipped_taken: 0 }
for (const f of files) {
  const path = join('journals/discovered', f)
  let changed = false
  const out = readFileSync(path, 'utf8').split('\n').map((line) => {
    if (!line.trim()) return line
    const r = JSON.parse(line)
    const code = codeOf.get(r.id), s = code && siteByCode.get(code)
    if (!s) return line
    let touched = false
    if (!r.country && s.country && nameToIso.get(s.country)) { r.country = nameToIso.get(s.country); stats.country++; touched = true }
    if (!r.website_url && s.website_url) { r.website_url = s.website_url; stats.website_url++; touched = true }
    if (!r.identifiers.openalex_source_id && s.openalex_source_id) {
      const owners = oaOwner.get(s.openalex_source_id) ?? []
      if (owners.length === 0) { r.identifiers.openalex_source_id = s.openalex_source_id; oaOwner.set(s.openalex_source_id, [r.id]); stats.openalex_source_id++; touched = true }
      else stats.openalex_skipped_taken++
    }
    if (!touched) return line
    r.provenance.push({ source: 'posi_curation', source_record_id: s.id, retrieved_at: NOW, license: null })
    r.updated_at = NOW
    stats.records++; changed = true
    return JSON.stringify(r)
  })
  if (changed && WRITE) writeFileSync(path, out.join('\n'), 'utf8')
}
console.log(WRITE ? 'written' : 'dry run', stats)
