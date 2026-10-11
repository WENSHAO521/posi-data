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
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { loadJournalRecords, loadSuperseded } from './lib/journal-records.mjs'

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null }
const WRITE = process.argv.includes('--write')
const siteFile = arg('site'), auditDir = resolve(arg('audit-dir') ?? '')
if (!siteFile || !arg('audit-dir')) { console.error('usage: --site <json> --audit-dir <dir> [--write]'); process.exit(2) }

const records = loadJournalRecords('.')
const coreIds = new Set()
const walkCore = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walkCore(p); else if (e.name.endsWith('.json')) coreIds.add(e.name.replace('.json', '')) } }
walkCore('journals/core')
const byIssn = new Map(), byOa = new Map()
const push = (m, k, id) => { if (!k) return; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(id) }
for (const r of records.values()) {
  const x = r.identifiers ?? {}
  for (const i of [x.issn_l, x.issn_print, x.issn_online]) push(byIssn, i, r.id)
  push(byOa, x.openalex_source_id, r.id)
}

// The registry keys a journal on the ISSN-L (or ISSN pair) it was minted with, which can differ from the
// ISSNs written on its record; an ISSN known there pairs with that journal too.
const superseded = loadSuperseded('.')
for (const l of readFileSync('registry/journal-id-map.csv', 'utf8').trim().split('\n').slice(1)) {
  const [id0, type, value] = l.split(',')
  const id = superseded.get(id0) ?? id0
  if (!records.has(id)) continue
  if (type === 'issn_l') push(byIssn, value, id)
  else if (type === 'issn_pair') for (const v of value.split('/')) push(byIssn, v, id)
}

const site = JSON.parse(readFileSync(siteFile, 'utf8'))
const unresolved = [], methods = {}, assigned = new Map()   // posi_id -> [{ s, method }]
const isCore = (id) => coreIds.has(id)
for (const s of site) {
  const viaIssn = new Set(); for (const i of [s.issn_online, s.issn_print]) for (const id of byIssn.get(i) ?? []) viaIssn.add(id)
  let ids = viaIssn, method = 'issn'
  if (ids.size === 0 && s.openalex_source_id) { ids = new Set(byOa.get(s.openalex_source_id) ?? []); method = 'openalex' }
  // Two POSI ids for one journal (ingested twice, not marked superseded): the one whose OpenAlex source id is
  // the website's, when exactly one is; else the only one in journals/core.
  if (ids.size > 1 && s.openalex_source_id) {
    const same = [...ids].filter((id) => records.get(id).identifiers?.openalex_source_id === s.openalex_source_id)
    if (same.length === 1) { ids = new Set(same); method += '+openalex' }
  }
  if (ids.size > 1) {
    const core = [...ids].filter(isCore)
    if (core.length === 1) { ids = new Set(core); method += '+core' }
  }
  if (ids.size !== 1) { unresolved.push({ site_id: s.id, title: s.title, why: ids.size === 0 ? 'no POSI journal' : `matches ${ids.size} POSI journals: ${[...ids].join(' ')}` }); continue }
  const posi_id = [...ids][0]
  if (!assigned.has(posi_id)) assigned.set(posi_id, [])
  assigned.get(posi_id).push({ s, method })
}
const normTitle = (t) => (t ?? '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const out = []
for (const [posi_id, group] of assigned) {
  // Several website records for one journal (a rename kept as two records, or a duplicate): the one titled
  // like the journal is the main one; the codes of the others stay as aliases so their URLs can redirect.
  const main = group.find((g) => normTitle(g.s.title) === normTitle(records.get(posi_id).title)) ?? group[0]
  const s = main.s
  methods[main.method] = (methods[main.method] ?? 0) + 1
  const aliases = group.filter((g) => g !== main).map((g) => g.s.journal_code)
  out.push({
    posi_id, journal_code: s.journal_code, ...(aliases.length ? { journal_code_aliases: aliases } : {}),
    language: s.language ?? null, frequency: s.frequency ?? null, license: s.license ?? null, peer_review_type: s.peer_review_type ?? null,
    oai_base_url: s.oai_base_url ?? null, registration_country: s.registration_country ?? null, doaj_status: s.doaj_status ?? null,
    metadata_quality_score: s.metadata_quality_score ?? null, transparency_score: s.transparency_score ?? null, indexing_readiness: s.indexing_readiness ?? null,
    pqf: s.pqf ?? null, article_count: s.article_count ?? null, auto_pqf: s.auto_pqf ?? null, subjects: s.subjects ?? null,
    crossref_checked_at: s.crossref_checked_at ?? null, created_at: s.created_at ?? null, updated_at: s.updated_at,
  })
}
out.sort((a, b) => (a.posi_id < b.posi_id ? -1 : 1))
const summary = { site_records: site.length, journals: out.length, site_records_covered: site.length - unresolved.length, with_aliases: out.filter((o) => o.journal_code_aliases).length, matched_by: methods, unresolved: unresolved.length }
console.log(summary)
if (WRITE) {
  mkdirSync(auditDir, { recursive: true })
  writeFileSync('screening/discovered-screening.jsonl', out.map((r) => JSON.stringify(r)).join('\n') + '\n')
  writeFileSync(join(auditDir, 'unresolved.csv'), 'site_id,title,why\n' + unresolved.map((u) => [u.site_id, JSON.stringify(u.title), JSON.stringify(u.why)].join(',')).join('\n') + '\n')
  writeFileSync(join(auditDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
}
