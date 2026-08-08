import { loadEnv } from './_env'
loadEnv()
import { FREE_LIMITS, assertFreeLimit } from '../src/lib/plan-limit'
import { isPaidPlan } from '../src/lib/unified-plan'

let ng = 0
const chk = (n: string, ok: boolean, d = '') => { if (!ok) ng++; console.log(`  ${ok ? 'OK  ' : '*** NG'} ${n}${d ? ` — ${d}` : ''}`) }

async function main() {
  console.log('=== services.ts の宣言と FREE_LIMITS の整合 ===')
  const src = require('fs').readFileSync('src/lib/services.ts', 'utf8') as string
  const decl: Record<string, string> = {}
  for (const sid of ['quote', 'aishodan', 'adimage', 'mensetsu']) {
    const m = src.match(new RegExp(`id: '${sid}',[\\s\\S]{0,6000}?free: \\{ name: '[^']*', limit: '([^']*)'`))
    decl[sid] = m ? m[1] : ''
  }
  chk('見積書3件 が宣言と一致', decl.quote.includes(String(FREE_LIMITS.quoteDocuments)), `宣言「${decl.quote}」/ 実装 ${FREE_LIMITS.quoteDocuments}`)
  chk('商材1件 が宣言と一致', decl.aishodan.includes(String(FREE_LIMITS.aishodanProducts)), `宣言「${decl.aishodan}」/ 実装 ${FREE_LIMITS.aishodanProducts}`)
  chk('商談5件 が宣言と一致', decl.aishodan.includes(String(FREE_LIMITS.aishodanSessions)), `実装 ${FREE_LIMITS.aishodanSessions}`)
  chk('面接3件 が宣言と一致', decl.mensetsu.includes(String(FREE_LIMITS.mensetsuSessions)), `宣言「${decl.mensetsu}」/ 実装 ${FREE_LIMITS.mensetsuSessions}`)
  chk('テンプレ1件 が宣言と一致', decl.mensetsu.includes(String(FREE_LIMITS.mensetsuTemplates)), `実装 ${FREE_LIMITS.mensetsuTemplates}`)

  console.log('\n=== isPaidPlan の判定 ===')
  chk('FREE → 無料', !isPaidPlan('FREE'))
  chk('null → 無料', !isPaidPlan(null))
  chk('undefined → 無料', !isPaidPlan(undefined))
  chk('PRO → 有料', isPaidPlan('PRO'))
  chk('banner-pro → 有料', isPaidPlan('banner-pro'))

  console.log('\n=== 上限判定（ownerUserId で無料ユーザーを模す）===')
  // 存在しないユーザーID = プラン取得できない = 無料扱い
  const NOBODY = 'nonexistent-user-id-for-test'
  for (const [used, expectOk] of [[0, true], [2, true], [3, false], [99, false]] as [number, boolean][]) {
    const r = await assertFreeLimit('quoteDocuments', async () => used, NOBODY)
    chk(`無料 / 既存${used}件 → ${expectOk ? '許可' : '拒否'}`, r.ok === expectOk, r.reason || `${r.used}/${r.limit}`)
  }
  const over = await assertFreeLimit('quoteDocuments', async () => 3, NOBODY)
  chk('拒否時に利用者向けの文言がある', !!over.reason && over.reason.includes('プロプラン'), over.reason)

  console.log(ng === 0 ? '\n結果: 全ケース期待どおり' : `\n結果: *** ${ng}件 期待外れ ***`)
}
main().catch(e => { console.error('失敗:', e.message); process.exit(1) })
