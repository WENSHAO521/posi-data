# Core Collection APCs — 2026-09-27

Records the article processing charge (APC) each Core Collection journal
states on its own website, as `apc` on its record in
`corpus/core-collection.json`:

```json
"apc": { "amount": 450, "currency": "USD", "note": "…", "source_url": "…", "checked_at": "2026-09-27" }
```

`amount` is the standard charge as stated; `note` carries the conditions the
page states (article types, page limits, promotional and regional rates,
waivers, surcharges); `amount: 0` means the journal states it charges no APC.

## Method

`scripts/extract-apc.mjs`, run through the "Collect APC evidence" workflow,
fetched each journal's pages from its official website, followed the site's
own fee links, and kept every passage about charges
([`candidates.json`](./candidates.json)). Each figure below was then read in
context and recorded only as the page states it. Two runs were made; a
journal with no stated APC after the second run is left without one.

Charges on ATRI's general page labelled optional premium services
(Accelerated Publication Service, Journal-Specific Formatting Service) are
not APCs and were not recorded.

## Result

| Journal | APC | Source |
|---|---|---|
| grhas | USD 450 | /grhas/APC-Policy-Schedule |
| afs | USD 300 | /afs/APC/WaiverPolicy |
| jlpcs | USD 275 (+10% handling) | /jlpcs/APC-Waiver-Policy |
| hnex | none until 2027, then USD 1,500 | /HealthNexus/APC-Waiver-Policy |
| pear | USD 350 | /pemr/article-processing-charge |
| jesa | USD 400 | /jesa/apcs |
| tts | USD 350 (2026 submissions USD 120) | /tts/article-processing-charge |
| rggd | USD 450 | /rggd/APC/Policy |
| rjgms | USD 400 (2026 submissions USD 140) | /Resonance/APC |
| csgs | USD 500 | /csgs/APC-Waiver-Policy |
| jscc | USD 600 | /jscc/APC-Waiver-Policy |
| cropt | CNY 1,320 / USD 165 | /cropt/apc-waiver-policy |
| jmss | USD 400 | atripress.org/jmss/APC |
| jcsis | USD 300 | atripress.org/index.php/index/Charge |
| jcac | USD 300 | atripress.org/index.php/index/Charge |
| rwxk | USD 200 / CNY 1,500 (4 pages) | ojs.shiharr.com/…/rwxk/apc |
| jyyjx | USD 200 / CNY 1,500 (4 pages) | ojs.shiharr.com/…/jyyjx/apc |
| jassp | USD 100 | ojs.shiharr.com/…/jassp/apc |
| yishu | USD 200 / CNY 1,200 | ojs.shiharr.com/…/yishu/APC2 |
| cmas | none | ojs.shiharr.com/…/cmas |

No stated APC found after two runs, so none recorded: silence, zgwxxk,
shr-ai, smn, xw, zgfx, cds, rae, eaou, tjiss, dif-rfp. Their sites answered,
but no page reached contained fee information.

The same runs found that the Panorama Scholarly Group journals moved from
`journals.panorama-sg.com/index.php/<journal>` to
`journals.panorama-sg.com/<journal>` (`site_check` in `candidates.json`);
their `website_url` was updated separately.
