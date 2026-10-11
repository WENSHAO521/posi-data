// Reads every POSI journal record (journals/core/**.json and journals/discovered/*.jsonl) into a map by id.
// A superseded id (registry/superseded-ids.csv) is left out: its journal is the survivor's.
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

export function loadSuperseded(root = '.') {
  const m = new Map()
  const f = join(root, 'registry/superseded-ids.csv')
  if (!existsSync(f)) return m
  for (const l of readFileSync(f, 'utf8').trim().split('\n').slice(1)) {
    const [o, n] = l.split(','); if (o && n) m.set(o, n)
  }
  return m
}

export function loadJournalRecords(root = '.') {
  const superseded = loadSuperseded(root)
  const records = new Map()
  const add = (r) => { if (r?.id && !superseded.has(r.id) && !records.has(r.id)) records.set(r.id, r) }
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) add(JSON.parse(readFileSync(p, 'utf8'))) } }
  walk(join(root, 'journals/core'))
  const dd = join(root, 'journals/discovered')
  for (const f of readdirSync(dd).filter((f) => f.endsWith('.jsonl'))) {
    for (const l of readFileSync(join(dd, f), 'utf8').split('\n')) if (l.trim()) add(JSON.parse(l))
  }
  return records
}
