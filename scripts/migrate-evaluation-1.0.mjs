#!/usr/bin/env node
/**
 * migrate-evaluation-1.0.mjs — POSI-EVAL-1.0 data migration for corpus/.
 *
 * Adds, and changes nothing else:
 *   early_stage_rating.rating          AJR Rating (A+ … D) from the record's own
 *                                      score, for records whose score is
 *                                      published (AJR-E-1.1 official or
 *                                      provisional). Never from a legacy
 *                                      E-Q/M-Q quartile; never for a mature
 *                                      journal scored with the AJR-E rubric
 *                                      (AJR-M has not run on it).
 *   early_stage_rating.rating_version  'AJR-RATING-1.0'
 *   early_stage_rating.deprecated_fields
 *                                      the legacy quartile fields present on
 *                                      the record (provisional_quartile,
 *                                      quartile, quartile_label, cohort_*,
 *                                      ranking_method), which stay as they are
 *                                      for the record and are no longer read.
 *
 * Idempotent: running it twice gives the same file. The rating table is
 * POSI-EVAL-1.0-SPEC.md § 3, the same as posi-engine evaluation.mjs
 * getAJRRating(); --check exits 1 if any stored rating disagrees with it.
 *
 *   node scripts/migrate-evaluation-1.0.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'fs'

const SCALE = [['A+', 90], ['A', 85], ['A−', 80], ['B+', 75], ['B', 70], ['B−', 65], ['C+', 60], ['C', 50], ['D', 0]]
export function getAJRRating(score) {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) return null
  return SCALE.find(([, min]) => score >= min)[0]
}
const LEGACY = ['provisional_quartile', 'quartile', 'quartile_label', 'cohort_key', 'cohort_level', 'cohort_size', 'ranking_method']

function publishedScore(r) {
  if (!r || r.total == null) return null
  if (r.version === 'AJR-E-1.1') return (r.rating_status === 'official' || r.rating_status === 'provisional') && r.lifecycle_stage !== 'mature' ? r.total : null
  return r.eligibility === 'early_stage' ? r.total : null // legacy shape: only early_stage carried an AJR-E score
}

const check = process.argv.includes('--check')
let problems = 0
for (const file of ['corpus/core-collection.json', 'corpus/global-benchmark.json']) {
  const raw = readFileSync(file, 'utf-8')
  const journals = JSON.parse(raw)
  let rated = 0
  for (const j of journals) {
    const r = j.early_stage_rating
    if (!r) continue
    const rating = getAJRRating(publishedScore(r))
    if (check) {
      if ((r.rating ?? null) !== rating) { problems++; console.error(`${j.posi_id}: stored rating ${r.rating} != ${rating}`) }
      continue
    }
    r.rating = rating
    r.rating_version = 'AJR-RATING-1.0'
    const present = LEGACY.filter(k => k in r)
    if (present.length) r.deprecated_fields = present
    if (rating) rated++
  }
  if (!check) {
    writeFileSync(file, JSON.stringify(journals, null, 2) + '\n')
    console.log(`${file}: ${journals.length} journals, ${rated} with an AJR Rating`)
  }
}
if (check) { console.log(problems ? `${problems} rating mismatches` : 'all AJR ratings match their scores'); process.exit(problems ? 1 : 0) }
