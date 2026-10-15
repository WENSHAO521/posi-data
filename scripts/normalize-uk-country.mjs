#!/usr/bin/env node
/**
 * normalize-uk-country.mjs
 *
 * journals/discovered/*.jsonl holds records with country "UK", which is not an ISO 3166-1 alpha-2 code
 * (schema/journal.schema.json); the United Kingdom is "GB", as in journals/core and corpus/.
 * This replaces "UK" with "GB" and nothing else. Every changed record gets a posi_curation provenance
 * entry and a new updated_at. Ids, the registry and journals/core are never touched.
 * Dry run unless --write.
 *
 *   node scripts/normalize-uk-country.mjs [--write]
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WRITE = process.argv.includes('--write')
const NOW = new Date().toISOString()
const dir = join(ROOT, 'journals/discovered')

let total = 0
for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl')).sort()) {
  let n = 0
  const out = readFileSync(join(dir, f), 'utf8').split('\n').map((line) => {
    if (!line.trim()) return line
    const r = JSON.parse(line)
    if (r.country !== 'UK') return line
    r.country = 'GB'
    r.provenance.push({ source: 'posi_curation', source_record_id: 'country:UK->GB', retrieved_at: NOW, license: null })
    r.updated_at = NOW
    n++
    return JSON.stringify(r)
  })
  if (n && WRITE) writeFileSync(join(dir, f), out.join('\n'), 'utf8')
  if (n) console.log(`${f}: ${n}`)
  total += n
}
console.log(WRITE ? 'written' : 'dry run', { uk_to_gb: total })
