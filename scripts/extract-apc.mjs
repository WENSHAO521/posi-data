#!/usr/bin/env node
/**
 * extract-apc.mjs
 *
 * Collects evidence of each Core Collection journal's article processing
 * charge (APC) from the journal's own website, for review. It does NOT write
 * an APC to any record: a person reads the quoted passages and records only
 * what a page actually states (see audits/data-quality/apc-2026/README.md).
 *
 * For every journal in corpus/core-collection.json it fetches the fee page
 * recorded by the evidence crawl (evidence/journals/*.json, fee_disclosure)
 * and the usual OJS pages (about, submissions, fees), strips the markup, and
 * keeps every passage near a fee keyword (APC, article processing charge,
 * publication fee, author fees, 版面费, 出版费, 文章处理费 ...) together with the
 * amounts it contains, and whether it says no fee is charged.
 *
 * It also checks each journal's registered website_url: whether it still
 * answers and where it redirects to. Journals whose sites have moved are
 * listed as moved (registered -> current address), and their fee pages are
 * looked up under the current address too.
 *
 * Output: audits/data-quality/apc-2026/candidates.json, and a readable
 * summary on stdout.
 *
 * Usage: node scripts/extract-apc.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'

const OUT_DIR = 'audits/data-quality/apc-2026'
const UA = 'POSI-EvidenceBot/1.0 (+https://posi.panorama-sg.com; posi@panoramagroup.org)'

const KEYWORDS = [
  'article processing charge', 'article processing fee', 'processing charge', 'apc', 'publication fee', 'publication charge',
  'author fee', 'author fees', 'submission fee', 'page charge', 'open access fee', 'free of charge', 'no charge', 'no fee', 'waiver',
  '版面费', '出版费', '文章处理费', '处理费', '审稿费', '费用', '收费', '不收取',
]
const NO_FEE = /(no (article processing |publication |author )?(charges?|fees?|apcs?)\b|free of charge|does not charge|do not charge|without (any )?(charge|fee)|不收取|免收|免费发表|无需支付)/i
const AMOUNT = /(?:(US\$|USD|\$|EUR|€|GBP|£|CNY|RMB|¥|￥|MYR|RM|SGD|S\$|HKD|HK\$)\s?(\d{1,3}(?:[,，]\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?))|(?:(\d{1,3}(?:[,，]\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s?(USD|US dollars?|dollars?|EUR|euros?|GBP|CNY|RMB|元|人民币|MYR|ringgit|SGD|HKD))/gi

function evidenceFeeUrls() {
  const byCode = new Map()
  for (const f of readdirSync('evidence/journals')) {
    const d = JSON.parse(readFileSync(join('evidence/journals', f), 'utf-8'))
    const fee = d.evidence_items?.find(i => i.id === 'fee_disclosure')
    const pages = (d.fetched_pages ?? []).filter(p => p.fetch_status === 'ok').map(p => p.url)
    byCode.set(d.journal_code, { fee: fee?.source_url ?? null, pages })
  }
  return byCode
}

function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|td)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#36;|&dollar;/g, '$').replace(/&euro;/g, '€').replace(/&yen;/g, '¥').replace(/&pound;/g, '£')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(25_000) })
    if (!res.ok) return { url, status: res.status, text: null }
    return { url: res.url || url, status: res.status, text: textOf(await res.text()) }
  } catch (e) {
    return { url, status: e.name === 'TimeoutError' ? 'timeout' : 'error', text: null }
  }
}

function passages(text) {
  const lower = text.toLowerCase()
  const hits = []
  for (const k of KEYWORDS) {
    // Word boundaries only for short Latin keywords (\b never matches around Chinese).
    const re = new RegExp(/^[a-z]{1,3}$/.test(k) ? `\\b${k}\\b` : k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    for (const m of lower.matchAll(re)) hits.push(m.index)
  }
  hits.sort((a, b) => a - b)
  // Merge nearby hits into windows of about 300 characters either side.
  const windows = []
  for (const i of hits) {
    const s = Math.max(0, i - 300)
    const e = Math.min(text.length, i + 300)
    const last = windows[windows.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else windows.push([s, e])
  }
  return windows.map(([s, e]) => text.slice(s, e).replace(/\n/g, ' / ').trim())
}

async function main() {
  const core = JSON.parse(readFileSync('corpus/core-collection.json', 'utf-8'))
  const ev = evidenceFeeUrls()
  const results = []
  for (const j of core) {
    const registered = (j.website_url || '').replace(/\/+$/, '')
    const home = registered ? await fetchText(registered) : { url: null, status: 'no website_url', text: null }
    const current = typeof home.status === 'number' && home.status < 400 ? home.url.replace(/\/+$/, '') : null
    const siteCheck = { registered: registered || null, status: home.status, current, moved: !!current && current !== registered }
    const e = ev.get(j.journal_code) ?? { fee: null, pages: [] }
    const bases = [...new Set([registered, current].filter(Boolean))]
    const urls = [...new Set([
      e.fee,
      ...bases.flatMap(b => [b, `${b}/about`, `${b}/about/submissions`, `${b}/apc`, `${b}/fees`, `${b}/author-fees`, `${b}/about/editorialPolicies`]),
      ...e.pages.filter(u => /fee|apc|charge|submission|about/i.test(u)),
    ].filter(Boolean))]
    const pages = []
    for (const url of urls) {
      const p = await fetchText(url)
      const found = p.text ? passages(p.text) : []
      pages.push({
        url: p.url, status: p.status,
        passages: found.map(t => ({ text: t, amounts: [...t.matchAll(AMOUNT)].map(m => m[0].trim()), says_no_fee: NO_FEE.test(t) })),
      })
    }
    const amounts = [...new Set(pages.flatMap(p => p.passages.flatMap(x => x.amounts)))]
    const saysNoFee = pages.some(p => p.passages.some(x => x.says_no_fee))
    results.push({ posi_id: j.posi_id, journal_code: j.journal_code, title: j.title, publisher: j.publisher, website_url: j.website_url, site_check: siteCheck, amounts_seen: amounts, says_no_fee: saysNoFee, pages })
    console.log(`\n## ${j.journal_code} — ${j.title}\n   site: ${registered || '(none)'} -> ${siteCheck.moved ? `MOVED to ${current}` : current ? 'ok' : `unreachable (${home.status})`}\n   amounts seen: ${amounts.join(', ') || 'none'}${saysNoFee ? '; a page says no fee' : ''}`)
    for (const p of pages) {
      for (const x of p.passages.filter(x => x.amounts.length || x.says_no_fee).slice(0, 3)) console.log(`   [${p.url}] ${x.text.slice(0, 500)}`)
    }
  }
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'candidates.json'), JSON.stringify({ generated_at: new Date().toISOString(), journals: results }, null, 2) + '\n')
  const moved = results.filter(r => r.site_check.moved)
  const down = results.filter(r => !r.site_check.current)
  console.log(`\nSites moved: ${moved.length}`)
  for (const r of moved) console.log(`   ${r.journal_code}: ${r.site_check.registered} -> ${r.site_check.current}`)
  console.log(`Sites unreachable: ${down.length}`)
  for (const r of down) console.log(`   ${r.journal_code}: ${r.site_check.registered} (${r.site_check.status})`)
  console.log(`\nWrote ${OUT_DIR}/candidates.json (${results.length} journals)`)
}

main().catch(e => { console.error(e); process.exit(1) })
