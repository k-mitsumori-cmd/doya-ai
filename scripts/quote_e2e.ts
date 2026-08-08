import { loadEnv } from './_env'
loadEnv()

import { analyzeProduct, suggestItems } from '../src/lib/quote/analyze'
import { PRICE_SOURCE_LABEL } from '../src/lib/quote/types'

async function run(url: string, name: string): Promise<number> {
  console.log(`\n${'='.repeat(64)}\n${name}  ${url}\n${'='.repeat(64)}`)
  const profile = await analyzeProduct(url)
  console.log('提供形態:', profile.deliveryModel, '/ 課金軸:', profile.pricingAxis)
  console.log('サイト記載の価格:', profile.publishedPrices?.length ? profile.publishedPrices : '（記載なし）')

  const items = await suggestItems({ profile, productName: profile.companyName || name })
  console.log(`\n品目 ${items.length}件:`)
  const tally: Record<string, number> = {}
  for (const i of items) {
    tally[i.priceSource] = (tally[i.priceSource] || 0) + 1
    const price = i.unitPrice == null ? '要見積' : `¥${i.unitPrice.toLocaleString()}`
    const range = i.rangeMin != null ? ` [相場 ${i.rangeMin.toLocaleString()}〜${i.rangeMax?.toLocaleString()}]` : ''
    console.log(`  ${price.padStart(12)} /${i.unit.padEnd(4)} [${PRICE_SOURCE_LABEL[i.priceSource]}] ${i.itemName}${range}`)
    console.log(`                 根拠: ${i.sourceRef.slice(0, 88)}`)
  }
  console.log('出所の内訳:', tally)

  let ng = 0
  for (const i of items) {
    if (i.priceSource === 'unknown' && i.unitPrice != null) { console.log(`  *** 違反: 根拠なしなのに金額がある: ${i.itemName}`); ng++ }
    if (i.priceSource === 'market' && i.rangeMin == null) { console.log(`  *** 違反: marketなのに相場範囲がない: ${i.itemName}`); ng++ }
    if (i.priceSource !== 'market' && (i.rangeMin != null || i.rangeMax != null)) { console.log(`  *** 違反: market以外に相場範囲が付いている: ${i.itemName}`); ng++ }
    if (i.priceSource === 'market' && i.rangeMin != null && i.rangeMax != null) {
      // 根拠の文言に、表示している範囲の数字が実際に含まれているか
      const wantMin = i.rangeMin.toLocaleString(), wantMax = i.rangeMax.toLocaleString()
      if (!i.sourceRef.includes(wantMin) || !i.sourceRef.includes(wantMax)) {
        console.log(`  *** 違反: 根拠と表示範囲が不一致: ${i.itemName}`); console.log(`         根拠「${i.sourceRef}」 vs 範囲 ${wantMin}〜${wantMax}`); ng++
      }
    }
    if (i.priceSource === 'market' && i.unitPrice != null && i.rangeMin != null && i.rangeMax != null
        && (i.unitPrice < i.rangeMin * 0.5 || i.unitPrice > i.rangeMax * 2)) {
      console.log(`  *** 違反: 相場から乖離: ${i.itemName} ${i.unitPrice}`); ng++
    }
  }
  console.log(ng === 0 ? '不変条件: 違反なし' : `*** 不変条件: ${ng}件違反 ***`)
  return ng
}

async function main() {
  let ng = 0
  ng += await run('https://doya-ai.surisuta.jp', '価格を公開しているサイト')
  ng += await run('https://game.surisuta.jp/noroi', '価格が明示されていないサイト')
  console.log(ng === 0 ? '\n総合: 全て期待どおり' : `\n総合: *** ${ng}件違反 ***`)
}
main().catch((e) => { console.error('失敗:', e.message); process.exit(1) })
