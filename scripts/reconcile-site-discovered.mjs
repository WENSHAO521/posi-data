#!/usr/bin/env node
/**
 * reconcile-site-discovered.mjs
 *
 * Read-only comparison of the website repository's discovered journals
 * (src/lib/discovered-journals.json in Panorama-Open-Scholarly-Index) with
 * the journal records in this repository (journals/core, journals/discovered).
 * It changes no record. It writes these files to --out so a person can decide,
 * list by list, which side is right before any data moves:
 *
 *   only-upstream.csv   journals here that the site does not have
 *   only-site.csv       journals the site has that no record here carries
 *   differences.csv     journals in both whose fields disagree
 *   ambiguous.csv       site records matching more than one upstream id
 *   upstream-shared-issn.csv  ISSNs that two or more POSI ids carry
 *   summary.json        counts per list and per field
 *
 * Journals are matched by ISSN (ISSN-L, print or online, any of them), the
 * identity registry/README.md puts first. A site record that matches two
 * different upstream records is reported as ambiguous, never merged.
 *
 * Usage:
 *   node scripts/reconcile-site-discovered.mjs \
 *     --site ../Panorama-Open-Scholarly-Index/src/lib/discovered-journals.json \
 *     --out audits/reconcile-site-discovered-<date>
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null }
const siteFile = arg('site'), outDir = arg('out')
if (!siteFile || !outDir) { console.error('usage: --site <discovered-journals.json> --out <dir>'); process.exit(2) }

// ---- upstream records -------------------------------------------------------
const up = []
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.json')) up.push({ ...JSON.parse(readFileSync(p, 'utf8')), _file: p.slice(ROOT.length + 1) })
  }
}
walk(join(ROOT, 'journals/core'))
const dd = join(ROOT, 'journals/discovered')
for (const f of readdirSync(dd).filter((f) => f.endsWith('.jsonl'))) {
  for (const l of readFileSync(join(dd, f), 'utf8').split('\n')) if (l.trim()) up.push({ ...JSON.parse(l), _file: `journals/discovered/${f}` })
}
const issnsOf = (r) => [r.identifiers?.issn_l, r.identifiers?.issn_print, r.identifiers?.issn_online].filter(Boolean)
const siteIssns = (r) => [r.issn_online, r.issn_print].filter(Boolean)

const upByIssn = new Map()
// A journal can be in journals/core and in journals/discovered under one id;
// the core record is the fuller one and is the one compared.
const upById = new Map()
for (const r of up) {
  const seen = upById.get(r.id)
  if (!seen || (r._file.startsWith('journals/core') && !seen._file.startsWith('journals/core'))) upById.set(r.id, r)
}
for (const r of upById.values()) for (const i of new Set(issnsOf(r))) {
  if (!upByIssn.has(i)) upByIssn.set(i, new Set())
  upByIssn.get(i).add(r)
}

const site = JSON.parse(readFileSync(siteFile, 'utf8'))

// ---- match ------------------------------------------------------------------
const norm = (s) => (s ?? '').toString().normalize('NFKC').toLowerCase().replace(/&/g, 'and').replace(/[^\p{L}\p{N}]+/g, ' ').trim()
const matchedUp = new Set()
const onlySite = [], ambiguous = [], pairs = []
for (const s of site) {
  const cands = new Set()
  for (const i of siteIssns(s)) for (const r of upByIssn.get(i) ?? []) cands.add(r)
  if (cands.size === 0) onlySite.push(s)
  else if (cands.size > 1) ambiguous.push({ s, cands: [...cands] })
  else { const [u] = cands; matchedUp.add(u); pairs.push([s, u]) }
}
for (const { cands } of ambiguous) cands.forEach((u) => matchedUp.add(u))
const onlyUp = [...upById.values()].filter((r) => !matchedUp.has(r))

// ---- field differences ------------------------------------------------------
const diffs = []
const diff = (field, s, u, a, b) => diffs.push({ field, site_id: s.id, posi_id: u.id, title: s.title, site: a ?? '', upstream: b ?? '', file: u._file })
for (const [s, u] of pairs) {
  if (norm(s.title) !== norm(u.title)) diff('title', s, u, s.title, u.title)
  if (norm(s.publisher) !== norm(u.publisher)) diff('publisher', s, u, s.publisher, u.publisher)
  const so = s.open_access ?? null, uo = u.open_access ?? null
  if (so !== uo) diff('open_access', s, u, so, uo)
  const x = u.identifiers ?? {}
  if ((s.issn_print ?? null) !== (x.issn_print ?? null)) diff('issn_print', s, u, s.issn_print, x.issn_print)
  if ((s.issn_online ?? null) !== (x.issn_online ?? null)) diff('issn_online', s, u, s.issn_online, x.issn_online)
  if ((s.openalex_source_id ?? null) !== (x.openalex_source_id ?? null)) diff('openalex_source_id', s, u, s.openalex_source_id, x.openalex_source_id)
}

// ---- write ------------------------------------------------------------------
const csv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n') + '\n'
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'only-upstream.csv'), csv(onlyUp.map((r) => ({ posi_id: r.id, title: r.title, publisher: r.publisher, issn_l: r.identifiers?.issn_l, issn_print: r.identifiers?.issn_print, issn_online: r.identifiers?.issn_online, status: r.status, file: r._file })), ['posi_id', 'title', 'publisher', 'issn_l', 'issn_print', 'issn_online', 'status', 'file']))
writeFileSync(join(outDir, 'only-site.csv'), csv(onlySite.map((s) => ({ site_id: s.id, title: s.title, publisher: s.publisher, issn_print: s.issn_print, issn_online: s.issn_online, doaj_status: s.doaj_status, openalex_source_id: s.openalex_source_id, created_at: s.created_at })), ['site_id', 'title', 'publisher', 'issn_print', 'issn_online', 'doaj_status', 'openalex_source_id', 'created_at']))
writeFileSync(join(outDir, 'differences.csv'), csv(diffs, ['field', 'site_id', 'posi_id', 'title', 'site', 'upstream', 'file']))
writeFileSync(join(outDir, 'ambiguous.csv'), csv(ambiguous.map(({ s, cands }) => ({ site_id: s.id, title: s.title, posi_ids: cands.map((c) => c.id).join(' ') })), ['site_id', 'title', 'posi_ids']))
// An ISSN carried by two or more different POSI ids: either a genuine merge/split
// to resolve, or records copied from one another (the site's former id collisions).
const shared = []
for (const [issn, set] of upByIssn) if (set.size > 1) shared.push({ issn, posi_ids: [...set].map((r) => r.id).join(' '), titles: [...set].map((r) => r.title).join(' | ') })
writeFileSync(join(outDir, 'upstream-shared-issn.csv'), csv(shared, ['issn', 'posi_ids', 'titles']))
const byField = {}
for (const d of diffs) byField[d.field] = (byField[d.field] ?? 0) + 1
const summary = { site_records: site.length, upstream_records: upById.size, matched: pairs.length, only_upstream: onlyUp.length, only_site: onlySite.length, ambiguous: ambiguous.length, issns_shared_by_several_posi_ids: shared.length, differences_by_field: byField }
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(summary)
