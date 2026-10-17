// ============================================
// ドヤポップアップ: 認証・所有者の確認・利用枠
// ============================================
// ⚠️ ログイン必須。サイト・案は必ず userId 付きで引く（他人のIDを指定されても返さない）。
// ⚠️ 上限値は plan-limit.ts の popupProposals / popupSites に集約。services.ts の表示文言と必ず合わせる。
// ⚠️ 判定はクロール・LLM の**前**。サイト行の作成と同じトランザクションで数える
//    （同時に押されて上限を1件超えるのを防ぐ。asklink/access.ts と同型）。
import { randomBytes } from 'node:crypto'
import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertLimitForTier, planTierOf, type QuotaResult } from '@/lib/plan-limit'

export async function getPopupUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const id = (session?.user as any)?.id as string | undefined
  if (id) return id
  const email = session?.user?.email
  if (!email) return null
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return u?.id ?? null
}

/** 自分の（削除していない）サイトだけに当たる条件 */
export function ownSite(userId: string, id: string) {
  return { id, userId, deletedAt: null }
}

/** 自分の案だけに当たる条件（サイトを削除したら案も見えなくする） */
export function ownPopup(userId: string, id: string) {
  return { id, userId, site: { deletedAt: null } }
}

/** 埋め込みタグの公開キー。推測できない乱数（24文字） */
export function newSiteKey(): string {
  return randomBytes(18).toString('base64url')
}

/**
 * 上限を確認したうえでサイト行を作る。上限なら作らずに理由を返す。
 * - 提案の回数（popupProposals）: 削除したサイトも数える（消して作り直せば枠が戻る、を防ぐ）
 * - サイトの数（popupSites）: 削除していないものだけ数える（無料は1サイト）
 */
export async function createSiteWithinQuota(
  userId: string,
  data: Omit<Prisma.PopupSiteUncheckedCreateInput, 'userId' | 'siteKey'>
): Promise<{ ok: true; siteId: string } | { ok: false; quota: QuotaResult }> {
  // ⚠️ プランはトランザクションの外で引く（中で別の問い合わせをすると接続待ちで固まる）
  const tier = await planTierOf(userId)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const proposals = await assertLimitForTier(
            'popupProposals',
            tier,
            () => tx.popupSite.count({ where: { userId } }),
            (since) => tx.popupSite.count({ where: { userId, createdAt: { gte: since } } })
          )
          if (!proposals.ok) return { ok: false as const, quota: proposals }
          const sites = await assertLimitForTier('popupSites', tier, () => tx.popupSite.count({ where: { userId, deletedAt: null } }))
          if (!sites.ok) return { ok: false as const, quota: sites }
          const site = await tx.popupSite.create({ data: { ...data, userId, siteKey: newSiteKey() }, select: { id: true } })
          return { ok: true as const, siteId: site.id }
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
