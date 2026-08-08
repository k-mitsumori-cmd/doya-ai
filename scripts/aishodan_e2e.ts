import { loadEnv } from './_env'
loadEnv()
import { advance } from '../src/lib/aishodan/engine'
import { DEFAULT_PHASES, DEFAULT_SLOTS, DEFAULT_ICP } from '../src/lib/aishodan/defaults'
import { evaluateSession } from '../src/lib/aishodan/evaluate'

let ng = 0
const chk = (n: string, ok: boolean, d = '') => { if (!ok) ng++; console.log(`  ${ok ? 'OK  ' : '*** NG'} ${n}${d ? ` — ${d}` : ''}`) }

const required = DEFAULT_SLOTS.filter(s => s.required)

console.log('=== 進行ステートマシン（LLMに任せない部分）===')
{
  // ヒアリング中、必須項目が残っていれば next を出されても留まる
  const r = advance({ phases: DEFAULT_PHASES, currentPhaseKey: 'hearing', phaseTurnCount: 3,
    elapsedSec: 120, durationMin: 15, unfilledRequiredSlots: required, intent: 'next' })
  chk('必須未回収でnext → 留まる', r.action === 'stay' && r.phaseKey === 'hearing', r.action)
  chk('次に聞くことを指定する', r.askNext !== null, r.askNext || '')
}
{
  // 必須が埋まればnextで進む
  const r = advance({ phases: DEFAULT_PHASES, currentPhaseKey: 'hearing', phaseTurnCount: 5,
    elapsedSec: 200, durationMin: 15, unfilledRequiredSlots: [], intent: 'next' })
  chk('必須充足でnext → 提案へ', r.action === 'next_phase' && r.phaseKey === 'proposal', r.phaseKey)
}
{
  // 答えない相手に無限に粘らない（ターン上限）
  const r = advance({ phases: DEFAULT_PHASES, currentPhaseKey: 'hearing', phaseTurnCount: 14,
    elapsedSec: 300, durationMin: 15, unfilledRequiredSlots: required, intent: 'next' })
  chk('ターン上限到達 → 必須が残っていても進む', r.action === 'next_phase', `${r.action}/${r.phaseKey}`)
}
{
  const r = advance({ phases: DEFAULT_PHASES, currentPhaseKey: 'proposal', phaseTurnCount: 99,
    elapsedSec: 100, durationMin: 15, unfilledRequiredSlots: [], intent: 'stay' })
  chk('stayでも上限超過なら進む', r.action === 'next_phase', r.phaseKey)
}
{
  // 時間切れは締めに倒す
  const r = advance({ phases: DEFAULT_PHASES, currentPhaseKey: 'hearing', phaseTurnCount: 2,
    elapsedSec: 15 * 60 - 30, durationMin: 15, unfilledRequiredSlots: required, intent: 'stay' })
  chk('残り時間わずか → 締めへ', r.action === 'close' && r.shouldClose, r.phaseKey)
}
{
  const r = advance({ phases: DEFAULT_PHASES, currentPhaseKey: 'opening', phaseTurnCount: 1,
    elapsedSec: 30, durationMin: 15, unfilledRequiredSlots: required, intent: 'end' })
  chk('相手が終了希望 → 即締め', r.action === 'close', r.phaseKey)
}
{
  // 不正なフェーズキーで落ちない
  const r = advance({ phases: DEFAULT_PHASES, currentPhaseKey: 'nonexistent', phaseTurnCount: 0,
    elapsedSec: 10, durationMin: 15, unfilledRequiredSlots: required, intent: 'stay' })
  chk('未知のフェーズ → 先頭にフォールバック', r.phaseKey === 'opening', r.phaseKey)
}
{
  // 最終フェーズからnext
  const r = advance({ phases: DEFAULT_PHASES, currentPhaseKey: 'closing', phaseTurnCount: 1,
    elapsedSec: 100, durationMin: 15, unfilledRequiredSlots: [], intent: 'next' })
  chk('最終フェーズからnext → 締め', r.action === 'close', r.action)
}

async function evalTest() {
  console.log('\n=== 適合判定（スコアはコードが計算し、根拠と食い違わないこと）===')
  const turns = [
    { speaker: 'ai', text: '本日はありがとうございます。まず現在のお困りごとを教えてください。' },
    { speaker: 'guest', text: '自社サイトからの問い合わせが月2件しかなく、営業が新規開拓に時間を取られています。' },
    { speaker: 'ai', text: '今はどのように対応されていますか。' },
    { speaker: 'guest', text: '営業3名が手作業でリストを作って架電しています。SEOは外注していましたが半年で解約しました。' },
    { speaker: 'ai', text: 'ご予算の目安はございますか。' },
    { speaker: 'guest', text: '月30万円までなら今期の販促予算から出せます。稟議は私と役員2名で決めます。' },
    { speaker: 'ai', text: 'いつ頃までに動かしたいとお考えですか。' },
    { speaker: 'guest', text: '来月中には始めたいです。期初なので今動きたい。' },
  ]
  const slotValues = [
    { key: 'challenge', value: '問い合わせが月2件。営業が新規開拓に時間を取られている' },
    { key: 'current_ops', value: '営業3名が手作業でリスト作成と架電。SEOは外注해 해약' },
    { key: 'budget', value: '月30万円まで' },
    { key: 'timing', value: '来月中' },
    { key: 'decision', value: '本人と役員2名' },
  ]
  const r = await evaluateSession({
    productName: 'ドヤマーケAI', icp: DEFAULT_ICP, slots: DEFAULT_SLOTS, slotValues, turns,
    unansweredQuestions: ['他社の導入事例で同業種はありますか'],
  })
  console.log(`  スコア ${r.fitScore} / 判定 ${r.verdict}`)
  console.log(`  理由: ${r.reason}`)
  console.log('  条件ごとの判定:')
  let gained = 0, total = 0
  for (const c of r.conditions) {
    total += c.weight; if (c.met) gained += c.weight
    console.log(`    ${c.met ? '○' : '−'} ${c.label}(${c.weight}) ${c.note.slice(0, 60)}`)
  }
  const expect = total > 0 ? Math.round(gained / total * 100) : 0
  chk('スコアが条件の重み合計と一致（モデル任せでない）', r.fitScore === expect, `${r.fitScore} vs ${expect}`)
  chk('判定がスコアと整合', (r.fitScore >= 75 ? 'hot' : r.fitScore >= 50 ? 'warm' : r.fitScore >= 25 ? 'cold' : 'unfit') === r.verdict)
  chk('次アクションが具体的（20字以上）', (r.nextAction || '').length >= 20, r.nextAction)
  console.log(`  次アクション: ${r.nextAction}`)
  console.log(`  要約: ${(r.summary.headline || []).join(' / ')}`)

  console.log(ng === 0 ? '\n総合: 全ケース期待どおり' : `\n総合: *** ${ng}件 期待外れ ***`)
}
evalTest().catch(e => { console.error('失敗:', e.message); process.exit(1) })
