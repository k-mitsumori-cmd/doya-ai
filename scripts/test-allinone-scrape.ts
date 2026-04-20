/**
 * スモークテスト: URL scrape が動作するか、軽量検証
 * 実行: npx tsx scripts/test-allinone-scrape.ts [URL]
 */
import { scrapeUrl } from '../src/lib/allinone/scrape'

async function main() {
  const url = process.argv[2] || 'https://example.com'
  console.log(`\n→ scrape: ${url}\n`)
  const r = await scrapeUrl(url)
  console.log('[OK] title        :', r.title)
  console.log('[OK] description  :', r.description?.slice(0, 80))
  console.log('[OK] finalUrl     :', r.finalUrl)
  console.log('[OK] h1           :', r.headings.h1.slice(0, 2))
  console.log('[OK] h2           :', r.headings.h2.slice(0, 3))
  console.log('[OK] imageCount   :', r.imageCount)
  console.log('[OK] heroImage    :', r.heroImage?.slice(0, 80))
  console.log('[OK] ogImage      :', r.ogImage?.slice(0, 80))
  console.log('[OK] mainColors   :', r.mainColors.slice(0, 6))
  console.log('[OK] fonts        :', r.fonts.slice(0, 4))
  console.log('[OK] hasOgp       :', r.hasOgp)
  console.log('[OK] hasCanonical :', r.hasCanonical)
  console.log('[OK] hasViewport  :', r.hasViewport)
  console.log('[OK] structData   :', r.hasStructuredData)
  console.log('[OK] analytics    :', r.hasAnalytics)
  console.log('[OK] CTAs (top 3) :', r.ctaTexts.slice(0, 3))
  console.log('[OK] intLinks cnt :', r.internalLinks.length)
  console.log('[OK] extLinks cnt :', r.externalLinks.length)
  console.log('[OK] socialLinks  :', r.socialLinks.map((s) => s.platform))
  console.log('[OK] wordCount    :', r.wordCount)
  console.log('[OK] textSample   :', r.textSample.slice(0, 120).replace(/\s+/g, ' '))
}

main().catch((err) => {
  console.error('[FAIL]', err instanceof Error ? err.message : err)
  process.exit(1)
})
