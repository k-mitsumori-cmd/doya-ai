// ============================================
// ドヤAI質問リンク 認証・利用枠
// ============================================
// ⚠️ ログイン必須。ゲスト（Cookie単位の上限）は Cookie を消せば何度でも回せ、
//    1回ごとに画像を3枚生成するため費用が青天井になる（adimage が 2026-08-17 に同じ理由で止めた）。
// ⚠️ 上限値は plan-limit.ts の asklinkRuns に集約。services.ts の表示文言と必ず合わせる。
// ⚠️ 判定はクロール・LLM・画像生成の**前**。run の作成と同じトランザクションで数える
//    （同時に押されて上限を1件超えるのを防ぐ）。
import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertFreeLimit, assertLimitForTier, planTierOf, type QuotaResult } from '@/lib/plan-limit'

export async function getAskLinkUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const id = (session?.user as any)?.id as string | undefined
  if (id) return id
  const email = session?.user?.email
  if (!email) return null
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return u?.id ?? null
}

/** 他人の run は決して解決しない（id と userId の二重条件） */
export function ownRun(userId: string, id: string) {
  return { id, userId }
}

/** 利用者が送ってくるIDの形式（cuid） */
export function isRunId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9]{20,40}$/i.test(id)
}

/**
 * 上限を確認したうえで run を作る。上限なら作らずに理由を返す。
 * Serializable で数えて作るので、同時実行で上限を超えない。
 */
export async function createRunWithinQuota(
  userId: string,
  data: Omit<Prisma.AskLinkRunUncheckedCreateInput, 'userId'>
): Promise<{ ok: true; runId: string } | { ok: false; quota: QuotaResult }> {
  // ⚠️ プランはトランザクションの外で引く（中で別の問い合わせをすると接続待ちで固まる）
  const tier = await planTierOf(userId)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const quota = await assertLimitForTier(
            'asklinkRuns',
            tier,
            () => tx.askLinkRun.count({ where: { userId } }),
            (since) => tx.askLinkRun.count({ where: { userId, createdAt: { gte: since } } })
          )
          if (!quota.ok) return { ok: false as const, quota }
          const run = await tx.askLinkRun.create({ data: { ...data, userId }, select: { id: true } })
          return { ok: true as const, runId: run.id }
        },
        { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 }
      )
    } catch (e) {
      // P2034: 直列化の競合 / P2028: 同時実行で開始待ちが切れた。どちらも作り直せば通る
      const code = (e as { code?: string })?.code
      if ((code !== 'P2034' && code !== 'P2028') || attempt === 4) throw e
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1) + Math.floor(Math.random() * 200)))
    }
  }
  throw new Error('unreachable')
}

/** 利用状況（サイドバー表示用） */
export async function readAskLinkUsage(userId: string) {
  const quota = await assertFreeLimit(
    'asklinkRuns',
    () => prisma.askLinkRun.count({ where: { userId } }),
    userId,
    (since) => prisma.askLinkRun.count({ where: { userId, createdAt: { gte: since } } })
  )
  return quota
}
