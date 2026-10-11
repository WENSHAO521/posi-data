// The published collection discovered-journals: each screening record joined to its journal record.
// Identity and descriptive fields come from journals/ (country as ISO 3166-1 alpha-2); the screening
// fields come from screening/discovered-screening.jsonl. A screening record whose journal record is
// gone is an error, not a silent drop.
import { readFileSync } from 'fs'
import { join } from 'path'
import { loadJournalRecords } from './journal-records.mjs'

export function composeDiscovered(root = '.') {
  const journals = loadJournalRecords(root)
  const out = []
  for (const l of readFileSync(join(root, 'screening/discovered-screening.jsonl'), 'utf8').split('\n')) {
    if (!l.trim()) continue
    const s = JSON.parse(l)
    const j = journals.get(s.posi_id)
    if (!j) throw new Error(`screening record ${s.posi_id} has no journal record`)
    const x = j.identifiers ?? {}
    out.push({
      posi_id: j.id, journal_code: s.journal_code, journal_code_aliases: s.journal_code_aliases ?? [],
      title: j.title, short_title: j.short_title ?? null,
      issn_print: x.issn_print ?? null, issn_online: x.issn_online ?? null,
      publisher: j.publisher ?? null, country: j.country ?? null, open_access: j.open_access ?? null,
      website_url: j.website_url ?? null, openalex_source_id: x.openalex_source_id ?? null,
      language: s.language, frequency: s.frequency, license: s.license, peer_review_type: s.peer_review_type,
      oai_base_url: s.oai_base_url, registration_country: s.registration_country, doaj_status: s.doaj_status,
      metadata_quality_score: s.metadata_quality_score, transparency_score: s.transparency_score,
      indexing_readiness: s.indexing_readiness, pqf: s.pqf, article_count: s.article_count, auto_pqf: s.auto_pqf,
      subjects: s.subjects, crossref_checked_at: s.crossref_checked_at, created_at: s.created_at, updated_at: s.updated_at,
    })
  }
  out.sort((a, b) => (a.posi_id < b.posi_id ? -1 : 1))
  return out
}
