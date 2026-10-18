// ============================================
// ドヤ社内インタビュー 認証・利用枠
// ============================================
// ⚠️ ログイン必須（社員が回答する公開アンケート画面だけはトークンで開く）。
// ⚠️ 上限値は plan-limit.ts の shanaiArticles / shanaiTranscripts に集約。services.ts の表示文言と合わせる。
// ⚠️ 判定は LLM・文字起こしの**前**に、記録の作成と同じトランザクションで数える。
// ⚠️ 数えるのは shanai_usage_log（台帳）。記事やインタビューの行を数えると、削除で枠が戻ってしまう。
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertFreeLimit, assertLimitForTier, planTierOf, type QuotaResult } from '@/lib/plan-limit'

export const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function getShanaiUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const id = (session?.user as any)?.id as string | undefined
  if (id) return id
  const email = session?.user?.email
  if (!email) return null
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return u?.id ?? null
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS })
}

export function unauthorized() {
  return json({ error: 'ログインが必要です。' }, 401)
}

export function notFound() {
  return json({ error: 'インタビューが見つかりません。' }, 404)
}

export function quotaExceeded(quota: QuotaResult) {
  return json(
    {
      error: quota.reason || '今月の利用上限に達しました。',
      limitReached: true,
      used: quota.used,
      limit: quota.limit,
      upgradeUrl: '/shanai/pricing',
    },
    429
  )
}

/** 他人のインタビューは決して解決しない（id と userId の二重条件） */
export function ownInterview(userId: string, id: string) {
  return { id, userId }
}

async function withSerializableRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn()
    } catch (e) {
      // P2034: 直列化の競合 / P2028: 開始待ちの時間切れ。作り直せば通る
      const code = (e as { code?: string })?.code
      if ((code !== 'P2034' && code !== 'P2028') || attempt === 4) throw e
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1) + Math.floor(Math.random() * 200)))
    }
  }
  throw new Error('unreachable')
}

/**
 * 記事生成の枠を確保する。確保できたら版番号付きの空の記事行を作って返す
 * （生成に失敗したら呼び出し側で行を消し、枠を戻す）。
 */
/** 記事生成に失敗したときに枠を戻す（記事の行と台帳を消す） */
export async function releaseArticle(articleId: string) {
  await prisma.$transaction([
    prisma.shanaiUsageLog.deleteMany({ where: { articleId } }),
    prisma.shanaiArticle.deleteMany({ where: { id: articleId } }),
  ])
}

export async function reserveArticle(
  userId: string,
  interviewId: string
): Promise<{ ok: true; articleId: string; version: number } | { ok: false; quota: QuotaResult }> {
  const tier = await planTierOf(userId)
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const quota = await assertLimitForTier(
          'shanaiArticles',
          tier,
          () => tx.shanaiUsageLog.count({ where: { userId, kind: 'article' } }),
          (since) => tx.shanaiUsageLog.count({ where: { userId, kind: 'article', createdAt: { gte: since } } })
        )
        if (!quota.ok) return { ok: false as const, quota }
        const last = await tx.shanaiArticle.findFirst({ where: { interviewId }, orderBy: { version: 'desc' }, select: { version: true } })
        const version = (last?.version || 0) + 1
        const row = await tx.shanaiArticle.create({
          data: { interviewId, userId, version, title: '生成中', lead: '', blocks: [] },
          select: { id: true },
        })
        await tx.shanaiUsageLog.create({ data: { userId, kind: 'article', interviewId, articleId: row.id } })
        return { ok: true as const, articleId: row.id, version }
      },
      { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 }
    )
  )
}

/** 1インタビューで文字起こしを依頼できる回数（録音の差し替え1回を含む） */
export const MAX_TRANSCRIPT_RUNS_PER_INTERVIEW = 2

/**
 * 文字起こしの枠を確保する。初回の依頼だけを枠として数え、差し替えはインタビューごとの回数で止める。
 */
export async function reserveTranscript(
  userId: string,
  interviewId: string
): Promise<{ ok: true } | { ok: false; quota?: QuotaResult; reason?: string }> {
  const tier = await planTierOf(userId)
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const row = await tx.shanaiInterview.findFirst({
          where: ownInterview(userId, interviewId),
          select: { transcriptRuns: true, transcribedAt: true },
        })
        if (!row) return { ok: false as const, reason: 'インタビューが見つかりません。' }
        if (row.transcriptRuns >= MAX_TRANSCRIPT_RUNS_PER_INTERVIEW) {
          return { ok: false as const, reason: '1件のインタビューで文字起こしできるのは2回までです。新しいインタビューを作成してください。' }
        }
        if (!row.transcribedAt) {
          const quota = await assertLimitForTier(
            'shanaiTranscripts',
            tier,
            () => tx.shanaiUsageLog.count({ where: { userId, kind: 'transcript' } }),
            (since) => tx.shanaiUsageLog.count({ where: { userId, kind: 'transcript', createdAt: { gte: since } } })
          )
          if (!quota.ok) return { ok: false as const, quota }
          await tx.shanaiUsageLog.create({ data: { userId, kind: 'transcript', interviewId } })
        }
        await tx.shanaiInterview.update({
          where: { id: interviewId },
          data: {
            transcriptRuns: { increment: 1 },
            transcribedAt: row.transcribedAt ?? new Date(),
            transcriptStatus: 'processing',
            transcriptError: null,
            transcriptJobId: null,
          },
        })
        return { ok: true as const }
      },
      { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 }
    )
  )
}

/** 1インタビューで事実を抽出できる回数 */
export const MAX_FACT_RUNS_PER_INTERVIEW = 5

/**
 * 事実の抽出を始めてよいか。記事の枠が残っていること（抽出しても記事にできないなら費用だけかかる）と、
 * インタビューごとの回数を確認し、回数を1つ確保する。
 */
export async function claimFactRun(userId: string, interviewId: string): Promise<{ ok: true } | { ok: false; quota?: QuotaResult; reason?: string }> {
  const quota = await assertFreeLimit(
    'shanaiArticles',
    () => prisma.shanaiUsageLog.count({ where: { userId, kind: 'article' } }),
    userId,
    (since) => prisma.shanaiUsageLog.count({ where: { userId, kind: 'article', createdAt: { gte: since } } })
  )
  if (!quota.ok) return { ok: false, quota }
  const claimed = await prisma.shanaiInterview.updateMany({
    where: { ...ownInterview(userId, interviewId), factRuns: { lt: MAX_FACT_RUNS_PER_INTERVIEW } },
    data: { factRuns: { increment: 1 } },
  })
  if (claimed.count === 0) return { ok: false, reason: `1件のインタビューで事実を抽出できるのは${MAX_FACT_RUNS_PER_INTERVIEW}回までです。` }
  return { ok: true }
}

/** 利用状況（サイドバー・設定画面用） */
export async function readShanaiUsage(userId: string) {
  const [articles, transcripts] = await Promise.all([
    assertFreeLimit(
      'shanaiArticles',
      () => prisma.shanaiUsageLog.count({ where: { userId, kind: 'article' } }),
      userId,
      (since) => prisma.shanaiUsageLog.count({ where: { userId, kind: 'article', createdAt: { gte: since } } })
    ),
    assertFreeLimit(
      'shanaiTranscripts',
      () => prisma.shanaiUsageLog.count({ where: { userId, kind: 'transcript' } }),
      userId,
      (since) => prisma.shanaiUsageLog.count({ where: { userId, kind: 'transcript', createdAt: { gte: since } } })
    ),
  ])
  return { articles, transcripts }
}
