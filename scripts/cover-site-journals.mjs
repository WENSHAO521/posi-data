#!/usr/bin/env node
/**
 * cover-site-journals.mjs
 *
 * Gives every journal of the website's discovered-journals.json a screening record, so the parity gate finds
 * none missing. The website's own DOAJ sync added journals after the screening import (90 on 2026-10-16)
 * that directory-sync never saw. For each website journal whose journal_code is neither a screening code
 * nor an alias:
 *   - an ISSN of it belongs to a journal that already has a screening record: its code is added to that
 *     record's journal_code_aliases (the website listed the journal a second time, under its other ISSN);
 *   - otherwise it goes through scripts/ingest-crossref-publisher.mjs (the registry decides whether it is new;
 *     a title clash with no ISSN in common is held for review) and, once it has a POSI id, gets a screening
 *     record with the website's screening fields.
 * Every alias and new record is listed in <audit-dir>/covered.csv. Nothing is deleted or overwritten.
 * Dry run unless --write; safe to re-run.
 *
 *   node scripts/cover-site-journals.mjs --site <discovered-journals.json> --engine <posi-engine> \
 *     --out <journals/discovered name> --audit-dir <dir> --retrieved YYYY-MM-DD [--write]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { execFileSync } from 'child_process'
import { loadJournalRecords } from './lib/journal-records.mjs'

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null }
const WRITE = process.argv.includes('--write')
for (const n of ['site', 'engine', 'out', 'audit-dir', 'retrieved']) if (!arg(n)) { console.error(`missing --${n}`); process.exit(2) }

const SCREEN_FIELDS = ['language', 'frequency', 'license', 'peer_review_type', 'oai_base_url', 'registration_country', 'doaj_status',
  'metadata_quality_score', 'transparency_score', 'indexing_readiness', 'pqf', 'article_count', 'auto_pqf', 'subjects', 'crossref_checked_at', 'created_at', 'updated_at']
const FILE = 'screening/discovered-screening.jsonl'
// Adds a code to a screening record's aliases, kept right after journal_code as in the other records.
const addAlias = (s, code) => {
  const { posi_id, journal_code, journal_code_aliases, ...rest } = s
  for (const k of Object.keys(s)) delete s[k]
  Object.assign(s, { posi_id, journal_code, journal_code_aliases: [...new Set([...(journal_code_aliases ?? []), code])].sort(), ...rest })
}
const csv = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

const site = JSON.parse(readFileSync(arg('site'), 'utf8'))
const screening = readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const covered = new Set(screening.flatMap((s) => [s.journal_code, ...(s.journal_code_aliases ?? [])]))
const missing = site.filter((w) => !covered.has(w.journal_code))

const screenIssn = () => {
  const journals = loadJournalRecords('.')
  const m = new Map()
  for (const s of screening) {
    const x = journals.get(s.posi_id)?.identifiers ?? {}
    for (const i of [x.issn_l, x.issn_print, x.issn_online]) if (i && !m.has(i)) m.set(i, s)
  }
  return m
}

const rows = [['action', 'site_id', 'title', 'posi_id', 'screening_code']]
const stats = { missing: missing.length, aliased: 0, candidates: 0, minted: 0, held_for_review: 0, new_screening: 0, left_missing: 0 }

// Second listings of a journal that has a screening record.
let byIssn = screenIssn()
const rest = []
for (const w of missing) {
  const s = [w.issn_online, w.issn_print].map((i) => i && byIssn.get(i)).find(Boolean)
  if (!s) { rest.push(w); continue }
  addAlias(s, w.journal_code)
  covered.add(w.journal_code); stats.aliased++
  rows.push(['alias', w.id, w.title, s.posi_id, s.journal_code])
}

// The rest through the registry.
const cand = rest.filter((w) => w.issn_print || w.issn_online).map((w) => {
  const t = []
  if (w.issn_online) t.push({ value: w.issn_online, type: 'electronic' })
  if (w.issn_print) t.push({ value: w.issn_print, type: 'print' })
  const listed = w.doaj_status === 'listed'
  return { title: w.title, publisher: w.publisher || undefined, ISSN: t.map((x) => x.value), 'issn-type': t, doaj: listed ? true : undefined,
    website_url: w.website_url || undefined, openalex_source_id: w.openalex_source_id || undefined,
    provenance: [{ source: listed ? 'doaj' : 'openalex', source_record_id: listed ? null : w.openalex_source_id ?? null }, { source: 'posi_curation', source_record_id: w.id }] }
})
stats.candidates = cand.length
if (cand.length && WRITE) {
  const dir = resolve(arg('audit-dir'))
  mkdirSync(dir, { recursive: true })
  const candFile = join(dir, 'candidates.json')
  writeFileSync(candFile, JSON.stringify(cand, null, 1) + '\n')
  const out = execFileSync('node', ['scripts/ingest-crossref-publisher.mjs', '--data', '.', '--engine', resolve(arg('engine')), '--candidates', candFile,
    '--member', 'site-coverage', '--retrieved', arg('retrieved'), '--out', arg('out'), '--audit-dir', dir], { encoding: 'utf8' })
  const res = JSON.parse(out.trim().split('\n').pop())
  stats.minted = res.ids_minted; stats.held_for_review = res.held_for_review

  // A screening record for each that now has a POSI id with none yet; otherwise an alias of the one it has.
  const journals = loadJournalRecords('.')
  const idByIssn = new Map()
  for (const j of journals.values()) for (const i of [j.identifiers?.issn_l, j.identifiers?.issn_print, j.identifiers?.issn_online]) if (i && !idByIssn.has(i)) idByIssn.set(i, j.id)
  const byId = new Map(screening.map((s) => [s.posi_id, s]))
  for (const w of rest) {
    const id = [w.issn_online, w.issn_print].map((i) => i && idByIssn.get(i)).find(Boolean)
    if (!id) continue
    const have = byId.get(id)
    if (have) {
      addAlias(have, w.journal_code)
      stats.aliased++; rows.push(['alias', w.id, w.title, id, have.journal_code])
    } else {
      const s = { posi_id: id, journal_code: w.journal_code }
      for (const f of SCREEN_FIELDS) s[f] = w[f] ?? null
      screening.push(s); byId.set(id, s); stats.new_screening++
      rows.push(['new', w.id, w.title, id, w.journal_code])
    }
    covered.add(w.journal_code)
  }
}
stats.left_missing = site.filter((w) => !covered.has(w.journal_code)).length

if (WRITE) {
  screening.sort((a, b) => (a.posi_id < b.posi_id ? -1 : 1))
  writeFileSync(FILE, screening.map((s) => JSON.stringify(s)).join('\n') + '\n')
  mkdirSync(arg('audit-dir'), { recursive: true })
  writeFileSync(join(arg('audit-dir'), 'covered.csv'), rows.map((r) => r.map(csv).join(',')).join('\n') + '\n')
}
console.log(WRITE ? 'written' : 'dry run', stats)
