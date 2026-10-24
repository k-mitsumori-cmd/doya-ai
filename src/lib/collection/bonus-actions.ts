'use server'
// 分野のスタンプのボーナスを受け取る（サーバーアクション。ボタンを押したときだけ動く）。
// - 会社はセッションの本人の会社だけ。そろっているかは、サーバーが記録から数え直す（クライアントの申告は信じない）
// - 台帳の grant（kind: bonus）。分野ごとに sourceKey で1回だけ。月の上限（MONTHLY_BONUS_CAP）に当たったら付かない
// - 旗が off・新しい見た目でないときは何もしない。有料の API は呼ばない
import { prisma } from '@/lib/prisma'
import { currentUserId } from '@/lib/shell/company.server'
import { isDoyaPowerEnabled } from '@/lib/doya-power/flag'
import { grant } from '@/lib/doya-power'
import { SHELL_GROUPS } from '@/components/shell/tools'
import { buildCatalog } from './catalog'
import { loadCollectionFacts } from './facts.server'
import { usedToolIds } from './score'
import { claimableAreas, stampSetKey, stampSets, STAMP_SET_BONUS } from './bonus'

export type ClaimResult = { ok: true; granted: number; message: string } | { ok: false; message: string }

export async function claimStampSetBonuses(): Promise<ClaimResult> {
  if (!(await isDoyaPowerEnabled())) return { ok: false, message: 'このボーナスはまだ使えません' }
  const userId = await currentUserId()
  if (!userId) return { ok: false, message: 'ログインしてください' }
  try {
    const company = await prisma.accountCompany.findUnique({ where: { userId }, select: { id: true } })
    if (!company) return { ok: false, message: '会社が登録されていません' }
    const facts = await loadCollectionFacts(userId)
    const areas = claimableAreas(stampSets(buildCatalog(SHELL_GROUPS), usedToolIds(facts.tools)))
    if (areas.length === 0) return { ok: false, message: 'そろった分野がまだありません' }
    let granted = 0
    let capped = false
    for (const area of areas) {
      const r = await grant(company.id, 'bonus', STAMP_SET_BONUS, null, { sourceKey: stampSetKey(area), note: `stampset:${area}` })
      if (r.ok && !r.duplicated) granted += r.granted
      if (!r.ok && r.reason === 'monthly_bonus_cap') capped = true
    }
    if (granted > 0) return { ok: true, granted, message: `${granted} ドヤパワーを受け取りました${capped ? '（今月のボーナスの上限に届いたため、残りは来月に受け取れます）' : ''}` }
    if (capped) return { ok: false, message: '今月のボーナスの上限に届いています。来月に受け取れます' }
    return { ok: true, granted: 0, message: 'そろった分野のボーナスは、すべて受け取り済みです' }
  } catch {
    return { ok: false, message: '受け取れませんでした。時間をおいて、もう一度お試しください' }
  }
}
