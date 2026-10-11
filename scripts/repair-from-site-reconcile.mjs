#!/usr/bin/env node
/**
 * repair-from-site-reconcile.mjs
 *
 * Applies the safe part of audits/reconcile-site-discovered-2026-10-11 to
 * journals/discovered/*.jsonl, from the website's discovered-journals.json.
 * Dry run unless --write. A record in journals/core is the fuller copy of its
 * journal: it gets only step 3, and only with --include-core (see the comment at
 * that loop); the same id in journals/discovered is skipped.
 *
 *  1. Contaminated records. The website once derived ids from a lossy title
 *     slug, so 32 journals shared four ids, and the initial migration copied
 *     the publisher, short title, website, country and online ISSN of the
 *     journal that won the collision into the other 31. Those 32 records are the
 *     ones whose posi_curation provenance names one of the four ids. Each is
 *     matched to the website's record by OpenAlex source id (exactly one match
 *     required) and its descriptive fields are replaced by that record's. Title,
 *     OpenAlex id, identity and POSI id are kept.
 *  2. Empty publisher. Where the record has no publisher and its single website
 *     match (by ISSN) has one, the website's value is filled in. A publisher
 *     that is set, in whatever spelling, is never changed.
 *  3. Open access unknown. A DOAJ-unlisted journal is not shown to be closed:
 *     where this repository says false and the website says unknown (null), the
 *     value becomes null, as in the website's correction of 2026-10-11.
 *
 * Every changed record gets a posi_curation provenance entry naming the website
 * record, and a new updated_at. Nothing else changes; ids, registry and the
 * file order are untouched.
 *
 * Usage:
 *   node scripts/repair-from-site-reconcile.mjs \
 *     --site ../Panorama-Open-Scholarly-Index/src/lib/discovered-journals.json \
 *     --countries ../Panorama-Open-Scholarly-Index/scripts/lib/country-codes.mjs \
 *     [--write]
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null }
const WRITE = process.argv.includes('--write')
const INCLUDE_CORE = process.argv.includes('--include-core')
if (!arg('site') || !arg('countries')) { console.error('usage: --site <json> --countries <country-codes.mjs> [--write]'); process.exit(2) }

const { isoToCountry } = await import(pathToFileURL(resolve(arg('countries'))).href)
const nameToIso = new Map()
for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') for (const b of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  const n = isoToCountry(a + b)
  if (n && n !== a + b) nameToIso.set(n, a + b)
}
const iso = (name) => (name ? nameToIso.get(name) ?? null : null)

const site = JSON.parse(readFileSync(arg('site'), 'utf8'))
const siteByOa = new Map(), siteByIssn = new Map()
for (const s of site) {
  if (s.openalex_source_id) (siteByOa.get(s.openalex_source_id) ?? siteByOa.set(s.openalex_source_id, []).get(s.openalex_source_id)).push(s)
  for (const i of [s.issn_online, s.issn_print]) if (i) (siteByIssn.get(i) ?? siteByIssn.set(i, new Set()).get(i)).add(s)
}
const COLLIDED = new Set(['j-disc-international-journal-of', 'j-disc-frontiers-in-environment', 'j-disc-canadian-journal-of-gast', 'j-disc-'])
const NOW = new Date().toISOString()
const stats = { contaminated: 0, contaminated_unmatched: 0, publisher_filled: 0, open_access_unknown: 0, unchanged: 0 }
const notes = []

// Core records: ids, files and parsed content.
const coreFiles = []
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) coreFiles.push(p) } }
walk(join(ROOT, 'journals/core'))
const coreIds = new Set(coreFiles.map((p) => p.split('/').pop().replace('.json', '')))

const siteMatch = (x) => {
  const set = new Set()
  for (const i of [x.issn_l, x.issn_print, x.issn_online].filter(Boolean)) for (const c of siteByIssn.get(i) ?? []) set.add(c)
  return set.size === 1 ? [...set][0] : null
}
// journals/core is opt-in: corpus/global-benchmark.json carries its own copy of open_access
// (published, hashed in releases), so changing only the journals/core copy would make them disagree.
for (const p of INCLUDE_CORE ? coreFiles : []) {
  const r = JSON.parse(readFileSync(p, 'utf8'))
  const s = siteMatch(r.identifiers ?? {})
  if (!s || r.open_access !== false || (s.open_access ?? null) !== null) continue
  r.open_access = null
  r.provenance.push({ source: 'posi_curation', source_record_id: s.id, retrieved_at: NOW, license: null })
  r.updated_at = NOW
  stats.open_access_unknown++
  if (WRITE) writeFileSync(p, JSON.stringify(r, null, 2) + '\n', 'utf8')
}

const dir = join(ROOT, 'journals/discovered')
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
  const lines = readFileSync(join(dir, f), 'utf8').split('\n')
  let changedFile = false
  const out = lines.map((line) => {
    if (!line.trim()) return line
    const r = JSON.parse(line)
    if (coreIds.has(r.id)) { stats.unchanged++; return line }
    const x = r.identifiers ?? {}
    let s = null, touched = false
    const collided = (r.provenance ?? []).some((p) => p.source === 'posi_curation' && COLLIDED.has(p.source_record_id))

    if (collided) {
      const m = x.openalex_source_id ? siteByOa.get(x.openalex_source_id) ?? [] : []
      if (m.length !== 1) { stats.contaminated_unmatched++; notes.push(`${r.id}: contaminated, ${m.length} website matches by OpenAlex id; left as is`); return line }
      s = m[0]
      if (r.provenance.some((p) => p.source_record_id === s.id)) { stats.unchanged++; return line } // already repaired
      r.short_title = s.short_title ?? null
      r.publisher = s.publisher || null
      r.country = iso(s.country)
      r.website_url = s.website_url || null
      x.issn_print = s.issn_print ?? null
      x.issn_online = s.issn_online ?? null
      if (x.issn_l && x.issn_l !== x.issn_print && x.issn_l !== x.issn_online) x.issn_l = x.issn_print ?? x.issn_online
      r.open_access = s.open_access ?? null
      stats.contaminated++; touched = true
    } else {
      s = siteMatch(x)
      if (s) {
        if (!r.publisher && s.publisher) { r.publisher = s.publisher; stats.publisher_filled++; touched = true }
        if (r.open_access === false && (s.open_access ?? null) === null) { r.open_access = null; stats.open_access_unknown++; touched = true }
      }
    }
    if (!touched) { stats.unchanged++; return line }
    r.provenance.push({ source: 'posi_curation', source_record_id: s.id, retrieved_at: NOW, license: null })
    r.updated_at = NOW
    changedFile = true
    return JSON.stringify(r)
  })
  if (changedFile && WRITE) writeFileSync(join(dir, f), out.join('\n'), 'utf8')
}
console.log(WRITE ? 'written' : 'dry run', stats)
for (const n of notes) console.log(n)
