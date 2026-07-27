// ============================================
// ドリップ自動エンロール（共通ロジック）
// ============================================
// auth.ts（初回ログイン時）と cron/hubspot-sync（HubSpotリード取り込み時）で共用。
import { prisma } from './prisma'

/**
 * ユーザーをアクティブなドリップシーケンスへエンロールする。
 * @param userId 対象ユーザーID
 * @param opts.startStep 開始ステップ（0=歓迎メールから / 1=歓迎スキップして2通目から）。既定0。
 */
export async function enrollUserInDripSequences(
  userId: string,
  opts: { startStep?: number } = {}
) {
  const startStep = opts.startStep ?? 0

  // 配信停止済みユーザーはエンロールしない
  const unsubscribed = await prisma.dripUnsubscribe.findFirst({
    where: { userId },
  })
  if (unsubscribed) return

  // アクティブなシーケンスを取得
  const activeSequences = await prisma.dripSequence.findMany({
    where: { status: 'active' },
    include: { segment: true },
  })

  // ユーザー情報を取得（セグメント判定用）
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, firstLoginAt: true, createdAt: true },
  })
  if (!user) return

  for (const seq of activeSequences) {
    // セグメント条件を評価
    if (seq.segment) {
      const conditions = seq.segment.conditions as Record<string, unknown>
      if (!matchesSegment(user, conditions)) continue
    }

    // 既にエンロール済みならスキップ
    const existing = await prisma.dripEnrollment.findUnique({
      where: { userId_sequenceId: { userId, sequenceId: seq.id } },
    })
    if (existing) continue

    // エンロール作成
    await prisma.dripEnrollment.create({
      data: { userId, sequenceId: seq.id, status: 'active', currentStep: startStep },
    })
  }
}

export function matchesSegment(
  user: { plan: string; firstLoginAt: Date | null; createdAt: Date },
  conditions: Record<string, unknown>
): boolean {
  const type = conditions.type as string
  if (!type || type === 'all') return true

  if (type === 'plan_and_active') {
    return user.plan === (conditions.plan as string)
  }

  if (type === 'last_login_over') {
    const days = (conditions.days as number) || 7
    const lastLogin = user.firstLoginAt || user.createdAt
    const daysSince = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)
    return daysSince >= days
  }

  return true
}
