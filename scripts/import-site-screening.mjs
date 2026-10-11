#!/usr/bin/env node
/**
 * import-site-screening.mjs
 *
 * One-off import of the website's discovered-journal screening data into
 * screening/discovered-screening.jsonl (schema/screening.schema.json), keyed by
 * POSI id, so the website repository no longer has to hold it.
 *
 * A website record is matched to a POSI journal by ISSN (any of its ISSNs, exactly
 * one POSI id), and when no ISSN matches, by OpenAlex source id (exactly one POSI
 * id): registry/README.md's identity priority, with no title similarity involved.
 * Records that match nothing, several journals, or a POSI id another website record
 * already took are written to the audit's unresolved.csv and not imported.
 *
 * Usage:
 *   node scripts/import-site-screening.mjs \
 *     --site ../Panorama-Open-Scholarly-Index/src/lib/discovered-journals.json \
 *     --audit-dir audits/migrations/site-screening-2026-10 [--write]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { loadJournalRecords } from './lib/journal-records.mjs'

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null }
const WRITE = process.argv.includes('--write')
const siteFile = arg('site'), auditDir = resolve(arg('audit-dir') ?? '')
if (!siteFile || !arg('audit-dir')) { console.error('usage: --site <json> --audit-dir <dir> [--write]'); process.exit(2) }

const records = loadJournalRecords('.')
const byIssn = new Map(), byOa = new Map()
const push = (m, k, id) => { if (!k) return; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(id) }
for (const r of records.values()) {
  const x = r.identifiers ?? {}
  for (const i of [x.issn_l, x.issn_print, x.issn_online]) push(byIssn, i, r.id)
  push(byOa, x.openalex_source_id, r.id)
}

const site = JSON.parse(readFileSync(siteFile, 'utf8'))
const out = [], unresolved = [], taken = new Map(), methods = {}
for (const s of site) {
  const viaIssn = new Set(); for (const i of [s.issn_online, s.issn_print]) for (const id of byIssn.get(i) ?? []) viaIssn.add(id)
  let ids = viaIssn, method = 'issn'
  if (ids.size === 0 && s.openalex_source_id) { ids = new Set(byOa.get(s.openalex_source_id) ?? []); method = 'openalex' }
  // Two POSI ids for one journal (a journal ingested twice, not yet marked superseded): the one whose
  // OpenAlex source id is the website's, when exactly one is.
  if (ids.size > 1 && s.openalex_source_id) {
    const same = [...ids].filter((id) => records.get(id).identifiers?.openalex_source_id === s.openalex_source_id)
    if (same.length === 1) { ids = new Set(same); method = method + '+openalex' }
  }
  if (ids.size !== 1) { unresolved.push({ site_id: s.id, title: s.title, why: ids.size === 0 ? 'no POSI journal' : `matches ${ids.size} POSI journals: ${[...ids].join(' ')}` }); continue }
  const posi_id = [...ids][0]
  if (taken.has(posi_id)) { unresolved.push({ site_id: s.id, title: s.title, why: `${posi_id} already taken by ${taken.get(posi_id)}` }); continue }
  taken.set(posi_id, s.id); methods[method] = (methods[method] ?? 0) + 1
  out.push({
    posi_id, journal_code: s.journal_code,
    language: s.language ?? null, frequency: s.frequency ?? null, license: s.license ?? null, peer_review_type: s.peer_review_type ?? null,
    oai_base_url: s.oai_base_url ?? null, registration_country: s.registration_country ?? null, doaj_status: s.doaj_status ?? null,
    metadata_quality_score: s.metadata_quality_score ?? null, transparency_score: s.transparency_score ?? null, indexing_readiness: s.indexing_readiness ?? null,
    pqf: s.pqf ?? null, article_count: s.article_count ?? null, auto_pqf: s.auto_pqf ?? null, subjects: s.subjects ?? null,
    crossref_checked_at: s.crossref_checked_at ?? null, created_at: s.created_at ?? null, updated_at: s.updated_at,
  })
}
out.sort((a, b) => (a.posi_id < b.posi_id ? -1 : 1))
const summary = { site_records: site.length, imported: out.length, matched_by: methods, unresolved: unresolved.length }
console.log(summary)
if (WRITE) {
  mkdirSync(auditDir, { recursive: true })
  writeFileSync('screening/discovered-screening.jsonl', out.map((r) => JSON.stringify(r)).join('\n') + '\n')
  writeFileSync(join(auditDir, 'unresolved.csv'), 'site_id,title,why\n' + unresolved.map((u) => [u.site_id, JSON.stringify(u.title), JSON.stringify(u.why)].join(',')).join('\n') + '\n')
  writeFileSync(join(auditDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
}
