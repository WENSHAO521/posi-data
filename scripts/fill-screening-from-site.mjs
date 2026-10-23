#!/usr/bin/env node
/**
 * fill-screening-from-site.mjs
 *
 * Fills empty screening fields in screening/discovered-screening.jsonl from the website's record for the
 * same journal (paired by journal_code), so the data layer holds what the website's daily jobs wrote after
 * the screening import. Only a null, empty or [] field is filled, and only these:
 *   - crossref_checked_at: the date the website's Crossref lookup last ran for the journal. directory-sync
 *     only looks up journals still missing a publisher or country, so a date the website wrote for a journal
 *     that has both since would otherwise never arrive;
 *   - subjects, registration_country, frequency, language, license, peer_review_type: DOAJ values the
 *     website read for journals that DOAJ listed after the import.
 * A value that is set is never changed. Every filled field is listed in --report (CSV). Dry run unless
 * --write; safe to re-run.
 *
 *   node scripts/fill-screening-from-site.mjs --site <discovered-journals.json> --report <filled.csv> [--write]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null }
const WRITE = process.argv.includes('--write')
if (!arg('site') || !arg('report')) { console.error('usage: --site <json> --report <csv> [--write]'); process.exit(2) }

const FIELDS = ['crossref_checked_at', 'subjects', 'registration_country', 'frequency', 'language', 'license', 'peer_review_type']
const empty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
const csv = (v) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

const siteByCode = new Map(JSON.parse(readFileSync(arg('site'), 'utf8')).map((s) => [s.journal_code, s]))
const FILE = 'screening/discovered-screening.jsonl'
const NOW = new Date().toISOString()
const stats = Object.fromEntries([...FIELDS.map((f) => [f, 0]), ['records', 0]])
const rows = [['posi_id', 'journal_code', 'field', 'value', 'site_id']]

const out = readFileSync(FILE, 'utf8').split('\n').map((line) => {
  if (!line.trim()) return line
  const s = JSON.parse(line)
  const w = siteByCode.get(s.journal_code)
  if (!w) return line
  let touched = false
  for (const f of FIELDS) {
    if (!empty(s[f]) || empty(w[f])) continue
    s[f] = w[f]; stats[f]++; touched = true
    rows.push([s.posi_id, s.journal_code, f, w[f], w.id])
  }
  if (!touched) return line
  s.updated_at = NOW
  stats.records++
  return JSON.stringify(s)
})

if (WRITE) {
  writeFileSync(FILE, out.join('\n'), 'utf8')
  mkdirSync(dirname(arg('report')), { recursive: true })
  writeFileSync(arg('report'), rows.map((r) => r.map(csv).join(',')).join('\n') + '\n', 'utf8')
}
console.log(WRITE ? 'written' : 'dry run', stats)
