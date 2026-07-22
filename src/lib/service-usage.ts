// ============================================
// サービス利用トラッキング（サーバー専用）
// ============================================
// 各サービスの「主要アクション」から呼び出し、Generation テーブルに
// 利用ログを1行残す。日次/週次/月次レポートのサービス別内訳は
// Generation を集計しているため、ここを通していないサービスは
// レポート上ずっと「利用0件」に見えてしまう（実際そうなっていた）。
//
// 併せて「そのユーザーがそのサービスを初めて使った瞬間」だけ
// Slack にリアルタイム通知する。2回目以降は通知しないので、
// 利用が増えても通知チャンネルが荒れない。
//
// ※ クライアント側の回数制限ロジックは `src/lib/usage.ts`（別物）。
// ============================================

import { prisma, withRetry } from './prisma'
import { serviceLabelOf } from './attribution'
import { postToSlackBlocks } from './notifications'
import { shouldSend } from './alert'
import { isPaidPlan } from './unified-plan'

/** 利用ログ行であることを示す outputType。バナー等の実コンテンツ行（IMAGE/TEXT）と区別する */
export const USAGE_OUTPUT_TYPE = 'USAGE'

const SUMMARY_MAX = 400
/** 同一ユーザー×サービスの初回通知が多重送信されないためのクールダウン（同一インスタンス内） */
const FIRST_USE_COOLDOWN_MS = 24 * 60 * 60 * 1000

export type ServiceUsageOptions = {
  /** 未ログイン（ゲスト利用）の場合は null/undefined でよい。その場合は記録しない */
  userId?: string | null
  /** services.ts の id、または独立ルートの識別子（'cunning' 等） */
  serviceId: string
  /** 「記事生成」「打刻」など、そのサービス内での操作名 */
  action?: string
  /** Slack通知・管理画面に出す入力の要約（URL・キーワード等） */
  summary?: string
  /** 1回の操作で作られた成果物の点数（画像5枚なら5）。集計の補助情報 */
  count?: number
  /** 再現用の入力パラメータ。巨大な本文は入れないこと */
  input?: Record<string, unknown>
  /** サービス固有の追加情報 */
  metadata?: Record<string, unknown>
}

function truncate(s: string, max: number): string {
  const str = String(s || '')
  return str.length > max ? `${str.slice(0, max)}…` : str
}

/**
 * サービス利用を記録する。
 *
 * 失敗しても呼び出し元の処理は絶対に壊さない（throw しない）ので、
 * 生成成功後に `void` で投げっぱなしにしてもよい。
 */
export async function recordServiceUsage(opts: ServiceUsageOptions): Promise<void> {
  const userId = opts.userId
  // Generation.userId は必須のためゲストは記録できない（件数は各サービスのゲスト上限で管理されている）
  if (!userId) return

  try {
    const serviceId = opts.serviceId
    // 行を作る前に「これまで一度も使っていないか」を見る
    const isFirst = await isFirstServiceUse(userId, serviceId)

    await withRetry(() => prisma.generation.create({
      data: {
        userId,
        serviceId,
        input: (opts.input ?? {}) as any,
        output: truncate(opts.summary || opts.action || '', SUMMARY_MAX),
        outputType: USAGE_OUTPUT_TYPE,
        metadata: {
          action: opts.action || '利用',
          count: opts.count ?? 1,
          ...(opts.metadata || {}),
        } as any,
      },
    }))

    if (isFirst) {
      await notifyFirstServiceUse({
        userId,
        serviceId,
        action: opts.action,
        summary: opts.summary,
      })
    }
  } catch (e) {
    console.error('[Usage] recordServiceUsage failed:', opts.serviceId, e instanceof Error ? e.message : e)
  }
}

/** そのユーザーがそのサービスの Generation 行をまだ1つも持っていないか */
export async function isFirstServiceUse(userId: string, serviceId: string): Promise<boolean> {
  try {
    // @@index([userId, serviceId]) が効くので軽い
    const prior = await withRetry(() => prisma.generation.count({ where: { userId, serviceId } }))
    return prior === 0
  } catch {
    // 判定できない時は通知しない側に倒す（誤通知より無通知）
    return false
  }
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

/**
 * 「初めてそのサービスを使った」ことを Slack にリッチ通知する。
 *
 * バナーのように自前で Generation 行を書くサービスは、行を作る前に
 * `isFirstServiceUse()` で判定し、作成後にこれを直接呼ぶ。
 */
export async function notifyFirstServiceUse(opts: {
  userId: string
  serviceId: string
  action?: string
  summary?: string
}): Promise<void> {
  const { userId, serviceId } = opts
  // 同時リクエストで二重に飛ぶのを抑える（インスタンスをまたぐ多重送信までは防げない）
  if (!shouldSend(`firstuse:${userId}:${serviceId}`, FIRST_USE_COOLDOWN_MS)) return

  try {
    const label = serviceLabelOf(serviceId)

    const [user, serviceUserRows, userServiceRows] = await Promise.all([
      safe(() => prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          plan: true,
          createdAt: true,
          signupService: true,
          signupSource: true,
        },
      }), null),
      // このサービスを使ったことのあるユーザー（この利用を含む）
      safe(() => prisma.generation.groupBy({ by: ['userId'], where: { serviceId } }), [] as { userId: string }[]),
      // このユーザーが触ったことのあるサービス
      safe(() => prisma.generation.groupBy({ by: ['serviceId'], where: { userId } }), [] as { serviceId: string }[]),
    ])

    const who = user?.name || user?.email || '不明なユーザー'
    const plan = user?.plan || 'FREE'
    const planLabel = isPaidPlan(plan) ? `${plan}（有料）` : `${plan}（無料）`

    const createdAt = user?.createdAt
    const daysSinceSignup = createdAt
      ? Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000))
      : null
    const signupLine = createdAt
      ? `${createdAt.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}（${daysSinceSignup === 0 ? '本日' : `${daysSinceSignup}日前`}）`
      : '不明'

    const acquisition = [
      user?.signupService ? `登録元: ${serviceLabelOf(user.signupService)}` : null,
      user?.signupSource ? `流入: ${user.signupSource}` : null,
    ].filter(Boolean).join('\n') || '不明'

    const serviceUserCount = serviceUserRows.length
    const otherServices = userServiceRows
      .map((r) => r.serviceId)
      .filter((id) => id !== serviceId)
    const otherServicesLabel = otherServices.length > 0
      ? otherServices.map(serviceLabelOf).join('・')
      : 'なし（ドヤAIで初めて触ったサービス）'

    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

    const blocks: unknown[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🚀 初回利用：${label}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*ユーザー*\n${who}${user?.email ? `\n${user.email}` : ''}` },
          { type: 'mrkdwn', text: `*プラン*\n${planLabel}` },
          { type: 'mrkdwn', text: `*登録日*\n${signupLine}` },
          { type: 'mrkdwn', text: `*獲得元*\n${acquisition}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `*操作*\n${opts.action || '利用'}`,
            opts.summary ? `> ${truncate(opts.summary, 300)}` : null,
          ].filter(Boolean).join('\n'),
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${label} の利用ユーザー *${serviceUserCount}人目* ｜ 併用サービス: ${otherServicesLabel} ｜ ${now}`,
          },
        ],
      },
    ]

    await postToSlackBlocks(`[初回利用] ${label} - ${who}`, blocks)
  } catch (e) {
    console.error('[Usage] notifyFirstServiceUse failed:', serviceId, e instanceof Error ? e.message : e)
  }
}
