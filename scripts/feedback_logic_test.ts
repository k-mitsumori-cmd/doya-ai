import { loadEnv } from './_env'
loadEnv()
import { FEEDBACK_THRESHOLDS, SNOOZE_DAYS, GLOBAL_COOLDOWN_DAYS } from '../src/lib/feedback'
import { isPaidPlan } from '../src/lib/unified-plan'

let ng = 0
const chk = (n: string, ok: boolean, d = '') => { if (!ok) ng++; console.log(`  ${ok ? 'OK  ' : '*** NG'} ${n}${d ? ` — ${d}` : ''}`) }

// shouldPromptFeedback と同じ順序で判定を再現し、条件の抜けを確かめる
type S = { plan: string; optedOut?: boolean; snoozeUntil?: number | null; lastShownAt?: number | null; answered?: boolean; usageCount: number }
function decide(s: S, now = Date.now()): { show: boolean; reason?: string } {
  if (isPaidPlan(s.plan)) return { show: false, reason: 'paid' }
  if (s.optedOut) return { show: false, reason: 'opted_out' }
  if (s.snoozeUntil && s.snoozeUntil > now) return { show: false, reason: 'snoozed' }
  if (s.lastShownAt && now - s.lastShownAt < GLOBAL_COOLDOWN_DAYS * 86400000) return { show: false, reason: 'cooldown' }
  if (s.answered) return { show: false, reason: 'already_answered' }
  if (!FEEDBACK_THRESHOLDS.includes(s.usageCount)) return { show: false, reason: `count_${s.usageCount}` }
  return { show: true }
}
const D = 86400000

console.log('=== 出すべきとき ===')
chk('無料 / 初回利用', decide({ plan: 'FREE', usageCount: 1 }).show)
chk('無料 / 3回目', decide({ plan: 'FREE', usageCount: 3 }).show)
chk('無料 / 10回目', decide({ plan: 'FREE', usageCount: 10 }).show)
chk('あとで から15日経過', decide({ plan: 'FREE', usageCount: 3, snoozeUntil: Date.now() - 1 * D }).show)

console.log('\n=== 出してはいけないとき ===')
chk('有料プランには出さない', !decide({ plan: 'PRO', usageCount: 1 }).show)
chk('banner-pro も有料', !decide({ plan: 'banner-pro', usageCount: 1 }).show)
chk('今後は表示しない を選ばれた', !decide({ plan: 'FREE', usageCount: 1, optedOut: true }).show)
chk('あとで の期間中', !decide({ plan: 'FREE', usageCount: 3, snoozeUntil: Date.now() + 3 * D }).show)
chk('別サービスで3日前に出した（連続表示を防ぐ）', !decide({ plan: 'FREE', usageCount: 1, lastShownAt: Date.now() - 3 * D }).show)
chk('そのサービスで既に回答済み', !decide({ plan: 'FREE', usageCount: 3, answered: true }).show)
chk('2回目（しきい値でない）', !decide({ plan: 'FREE', usageCount: 2 }).show)
chk('4回目（しきい値でない）', !decide({ plan: 'FREE', usageCount: 4 }).show)
chk('0回（まだ使っていない）', !decide({ plan: 'FREE', usageCount: 0 }).show)
chk('11回目（通り過ぎたら出さない）', !decide({ plan: 'FREE', usageCount: 11 }).show)

console.log('\n=== 実際にどれくらいの頻度で出るか ===')
// 無料ユーザーが1サービスを30回使った場合に何回出るか
let shown = 0
let lastShownAt: number | null = null
for (let n = 1; n <= 30; n++) {
  const r = decide({ plan: 'FREE', usageCount: n, lastShownAt }, Date.now() + n * 3 * D)
  if (r.show) { shown++; lastShownAt = Date.now() + n * 3 * D }
}
chk('30回使っても最大3回まで', shown <= 3, `${shown}回`)
console.log(`  しきい値: ${FEEDBACK_THRESHOLDS.join(' / ')}回目 / あとで=${SNOOZE_DAYS}日 / 連続防止=${GLOBAL_COOLDOWN_DAYS}日`)

console.log(ng === 0 ? '\n結果: 全ケース期待どおり' : `\n結果: *** ${ng}件 期待外れ ***`)
