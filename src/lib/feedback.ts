// ============================================
// 利用者フィードバックの表示判定
// ============================================
// 無料プランの方が「ドヤシリーズ」を使ったあとに、改善点・要望を書いてもらう。
//
// ⚠️ この機能は、間違えると**サービスの使い勝手そのものを損なう**。
//    毎回出す・複数サービスで続けて出す・断ったのにまた出す、のどれをやっても
//    「うるさいツール」になり、書いてもらうどころか使われなくなる。
//    出さない側に倒す条件を先に置いてある。
import { prisma } from '@/lib/prisma'
import { isPaidPlan } from '@/lib/unified-plan'
import { USAGE_OUTPUT_TYPE } from '@/lib/service-usage'

/**
 * 何回目の利用で聞くか。
 * ⚠️ 増やすほど回収数は上がるが、うるさくなる。ここだけ変えれば頻度を調整できる。
 *  - 1回目: 第一印象は最初にしか取れない。「ちょっと使った」直後がここ
 *  - 3回目: 一通り触ってみた時点の実感。使い勝手の不満が具体的になる頃
 *  - 10回目: 使い続けている人の要望（ここが一番具体的になる）
 *
 * ⚠️ 20回のような遠いしきい値は、そこまで使う人がほとんどいないので
 *    実質「出ない」に等しい。声を集めるのが目的なら手前に置くこと。
 */
export const FEEDBACK_THRESHOLDS = [1, 3, 10]

/** 「あとで」を押されてから、次に聞くまでの日数 */
export const SNOOZE_DAYS = 14
/** 別のサービスを使っても、この日数は続けて出さない */
export const GLOBAL_COOLDOWN_DAYS = 7

export interface PromptDecision {
  show: boolean
  /** 表示する場合、何回目の利用か（保存時に一緒に残す） */
  usageCount?: number
  /** 出さない理由（デバッグ用。画面には出さない） */
  reason?: string
}

/**
 * 今このサービスでフィードバックを聞いてよいか。
 * ⚠️ 迷ったら false（聞かない）に倒すこと。
 */
export async function shouldPromptFeedback(userId: string, serviceId: string): Promise<PromptDecision> {
  if (!userId || !serviceId) return { show: false, reason: 'no_user_or_service' }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
  if (!user) return { show: false, reason: 'no_user' }
  // ⚠️ 有料の方には出さない。お金を払っている相手にアンケートを挟まない
  if (isPaidPlan(user.plan)) return { show: false, reason: 'paid' }

  const state = await prisma.feedbackPromptState.findUnique({ where: { userId } })
  if (state?.optedOut) return { show: false, reason: 'opted_out' }

  const now = Date.now()
  if (state?.snoozeUntil && state.snoozeUntil.getTime() > now) {
    return { show: false, reason: 'snoozed' }
  }
  // 別サービスで最近出したばかりなら出さない
  if (state?.lastShownAt && now - state.lastShownAt.getTime() < GLOBAL_COOLDOWN_DAYS * 86400000) {
    return { show: false, reason: 'cooldown' }
  }

  // そのサービスで既に書いてもらっていれば、もう聞かない
  const already = await prisma.serviceFeedback.findFirst({
    where: { userId, serviceId },
    select: { id: true },
  })
  if (already) return { show: false, reason: 'already_answered' }

  // このサービスを何回使ったか（利用ログ = Generation の USAGE 行）
  const usageCount = await prisma.generation.count({
    where: { userId, serviceId, outputType: USAGE_OUTPUT_TYPE },
  })
  if (!FEEDBACK_THRESHOLDS.includes(usageCount)) {
    return { show: false, reason: `count_${usageCount}` }
  }

  return { show: true, usageCount }
}

/** 表示したことを記録する（次の判定で連続表示を防ぐため） */
export async function markPromptShown(userId: string): Promise<void> {
  await prisma.feedbackPromptState.upsert({
    where: { userId },
    create: { userId, lastShownAt: new Date() },
    update: { lastShownAt: new Date() },
  })
}

/** 「あとで」 */
export async function snoozePrompt(userId: string): Promise<void> {
  const snoozeUntil = new Date(Date.now() + SNOOZE_DAYS * 86400000)
  await prisma.feedbackPromptState.upsert({
    where: { userId },
    create: { userId, snoozeUntil, lastShownAt: new Date() },
    update: { snoozeUntil, lastShownAt: new Date() },
  })
}

/** 「今後は表示しない」 */
export async function optOutPrompt(userId: string): Promise<void> {
  await prisma.feedbackPromptState.upsert({
    where: { userId },
    create: { userId, optedOut: true, lastShownAt: new Date() },
    update: { optedOut: true, lastShownAt: new Date() },
  })
}
