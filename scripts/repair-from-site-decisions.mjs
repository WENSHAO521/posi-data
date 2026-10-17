#!/usr/bin/env node
/**
 * repair-from-site-decisions.mjs
 *
 * Applies, one field at a time, the decisions in the website's docs/MIGRATION-PLAN.md ("which side wins where both
 * have a value") to journals/discovered/*.jsonl. Dry run unless --write. Records in journals/core are never touched
 * (the corpus keeps its own copy). Every changed record gets a posi_curation provenance entry and a new updated_at.
 *
 *   --field website_url  The website's URL where this repository's differs beyond case, http/https, "www." and a
 *                        trailing slash. The website holds the current host (hindawi.com -> onlinelibrary.wiley.com,
 *                        sciendo.com -> reference-global.com, ...). An empty website URL changes nothing.
 *   --field publisher    The website's name where this repository's is the same name plus a parenthesised Crossref
 *                        qualifier ("Wiley (Blackwell Publishing)" -> "Wiley"). Other differences are only listed.
 *   --field title        The website's title where this repository's is in a non-Latin script, a "a/a" parallel
 *                        title, or ends in a parenthetical ("(Chichester, England. Print)"). The replaced title is
 *                        kept in alternate_titles as a variant, so it stays searchable. A site title that is itself
 *                        empty or non-Latin changes nothing.
 *
 *   node scripts/repair-from-site-decisions.mjs --field <f> --site <discovered-journals.json> [--write]
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null }
const WRITE = process.argv.includes('--write')
const FIELD = arg('field')
if (!['website_url', 'publisher', 'title'].includes(FIELD) || !arg('site')) { console.error('usage: --field website_url|publisher|title --site <json> [--write]'); process.exit(2) }

const text = (v) => String(v ?? '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const url = (v) => String(v ?? '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')
const nonLatin = (s) => /[^\u0000-ɏḀ-ỿ\s]/.test(s)

const site = JSON.parse(readFileSync(arg('site'), 'utf8'))
const siteById = new Map(site.map((s) => [s.id, s]))
const codeOf = new Map()
for (const l of readFileSync(join(ROOT, 'screening/discovered-screening.jsonl'), 'utf8').split('\n')) if (l.trim()) { const s = JSON.parse(l); codeOf.set(s.posi_id, s.journal_code) }

const coreIds = new Set()
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) coreIds.add(e.name.replace('.json', '')) } }
walk(join(ROOT, 'journals/core'))

// Returns the new value for the field, or null to leave the record alone (with a reason in review).
function decide(r, s, review) {
  const mine = r[FIELD], theirs = s[FIELD]
  if (!theirs || String(mine ?? '') === String(theirs)) return null
  if (FIELD === 'website_url') {
    if (mine && url(mine) === url(theirs)) return null
    return theirs
  }
  if (!mine) return null
  if (FIELD === 'publisher') {
    if (text(mine) === text(theirs)) return null
    const a = String(mine), b = String(theirs)
    if (a.startsWith(b + ' (') && a.endsWith(')')) return b
    review.push(`${r.id}\t"${a}"\t"${b}"`)
    return null
  }
  if (text(mine) === text(theirs) || !theirs.trim() || nonLatin(theirs)) return null
  if (nonLatin(mine) || /^(.+)\/\1$/i.test(String(mine).trim()) || /\([^)]*\)\s*$/.test(String(mine)) && !/\([^)]*\)\s*$/.test(theirs)) return theirs
  return null
}

const NOW = new Date().toISOString()
const stats = { changed: 0, skipped_core: 0, no_site: 0, unchanged: 0 }
const review = [], hosts = {}
const dir = join(ROOT, 'journals/discovered')
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
  let changed = false
  const out = readFileSync(join(dir, f), 'utf8').split('\n').map((line) => {
    if (!line.trim()) return line
    const r = JSON.parse(line)
    if (coreIds.has(r.id)) { stats.skipped_core++; return line }
    const s = siteById.get(`j-disc-${codeOf.get(r.id)}`)
    if (!s) { stats.no_site++; return line }
    const v = decide(r, s, review)
    if (v === null) { stats.unchanged++; return line }
    if (FIELD === 'title') (r.alternate_titles ??= []).push({ title: r.title, type: 'variant' })
    if (FIELD === 'website_url' && r.website_url) { const k = new URL(r.website_url, 'http://x').hostname.replace(/^www\./, '') + ' -> ' + new URL(v).hostname.replace(/^www\./, ''); hosts[k] = (hosts[k] ?? 0) + 1 }
    r[FIELD] = v
    r.provenance.push({ source: 'posi_curation', source_record_id: s.id, retrieved_at: NOW, license: null })
    r.updated_at = NOW
    stats.changed++
    changed = true
    return JSON.stringify(r)
  })
  if (changed && WRITE) writeFileSync(join(dir, f), out.join('\n'), 'utf8')
}
console.log(WRITE ? 'written' : 'dry run', FIELD, stats)
if (FIELD === 'website_url') console.log(Object.entries(hosts).sort((a, b) => b[1] - a[1]).slice(0, 8))
if (review.length) console.log(`${review.length} for review:\n` + review.slice(0, 5).join('\n'))
