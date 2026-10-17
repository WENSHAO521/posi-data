#!/usr/bin/env node
/**
 * apply-issn-review.mjs
 *
 * Applies the print/online ISSN suggestions of audits/data-quality/issn-regression-review-2026-10-17/review-135.csv
 * to journals/discovered/*.jsonl. Only a row that is not a journals/core record, whose authority check says
 * "已核实" (verified) or "印刷版已核" (print verified), and that is not in the ISSN conflict queue (#102)
 * is applied; a suggested ISSN that fails its check digit or is held by another record is refused.
 * Dry run unless --write. Every changed record gets a posi_curation provenance entry and a new updated_at.
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadJournalRecords } from './lib/journal-records.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIT = 'issn-regression-review-2026-10-17/review-135.csv'
const WRITE = process.argv.includes('--write')
const checkOk = (v) => { const d = String(v).replace('-', ''); if (!/^\d{7}[\dX]$/.test(d)) return false; let t = 0; for (let i = 0; i < 7; i++) t += (8 - i) * Number(d[i]); const c = (11 - (t % 11)) % 11; return d[7] === (c === 10 ? 'X' : String(c)) }

function parseCsv(s) { // quoted fields, embedded commas and newlines
  const rows = []; let row = [], f = '', q = false
  for (let i = 0; i < s.length; i++) { const c = s[i]
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = '' }
    else if (c !== '\r') f += c }
  if (f || row.length) { row.push(f); rows.push(row) }
  return rows
}
const rows = parseCsv(readFileSync(join(ROOT, 'audits/data-quality', AUDIT), 'utf8').replace(/^﻿/, ''))
const head = rows.shift(), col = (n) => head.indexOf(n)
const C = { id: col('POSI编号'), core: col('核心集合记录'), p: col('建议:印刷版ISSN'), o: col('建议:在线版ISSN'), auth: col('是否权威已核'), note: col('异常提示') }

const holders = new Map()
for (const r of loadJournalRecords(ROOT).values()) for (const v of [r.identifiers?.issn_l, r.identifiers?.issn_print, r.identifiers?.issn_online]) if (v) (holders.get(v) ?? holders.set(v, new Set()).get(v)).add(r.id)

const plan = new Map(), skipped = []
for (const r of rows) {
  if (r.length < head.length) continue
  const id = r[C.id]
  if (r[C.core] !== '否') { skipped.push(`${id}: core record`); continue }
  if (!/^(已核实|印刷版已核)/.test(r[C.auth])) { skipped.push(`${id}: not verified (${r[C.auth]})`); continue }
  if (/#102/.test(r[C.note])) { skipped.push(`${id}: in the ISSN conflict queue (#102)`); continue }
  const bad = [r[C.p], r[C.o]].filter((v) => v && (!checkOk(v) || [...(holders.get(v) ?? [])].some((h) => h !== id)))
  if (bad.length) { skipped.push(`${id}: ${bad.join(' ')} fails check digit or is held by another record`); continue }
  plan.set(id, { p: r[C.p], o: r[C.o] })
}

const NOW = new Date().toISOString(); let n = 0
const dir = join(ROOT, 'journals/discovered')
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
  let changed = false
  const out = readFileSync(join(dir, f), 'utf8').split('\n').map((line) => {
    if (!line.trim()) return line
    const r = JSON.parse(line), p = plan.get(r.id)
    if (!p) return line
    const x = (r.identifiers ??= {})
    if (x.issn_print === p.p && x.issn_online === p.o) return line
    if (p.p) x.issn_print = p.p
    if (p.o) x.issn_online = p.o
    r.provenance.push({ source: 'posi_curation', source_record_id: AUDIT, retrieved_at: NOW, license: null })
    r.updated_at = NOW; n++; changed = true
    return JSON.stringify(r)
  })
  if (changed && WRITE) writeFileSync(join(dir, f), out.join('\n'), 'utf8')
}
console.log(WRITE ? 'written' : 'dry run', { planned: plan.size, changed: n, skipped: skipped.length })
for (const s of skipped) console.log('skip', s)
