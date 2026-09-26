// ============================================
// ドヤAIO スキャン永続化の共通ロジック
// AioScan(processing) 作成 → executeScan 実行 → AioResult 一括保存
// → AioScan を done/failed に更新、まで一連を担当する。
// scans/route.ts（手動実行）と cron/aio-scan（定期実行）の両方から呼ぶ。
// ============================================
import { prisma } from '@/lib/prisma'
import { availableEngines, SCAN_STALE_MS, AIO_MAX_PROMPTS_PER_SCAN, type EngineId } from '@/lib/aio/types'
import { executeScan } from '@/lib/aio/scan'
import { getAioBilling } from '@/lib/aio/billing'
import { scanQuota } from '@/lib/aio/quota'

// 反復回数はプランで差別化しない（無料・プロ共通）。
// プランの差は「調査回数（スキャン頻度）」と「閲覧できる範囲」で付ける。
const DEFAULT_REPETITIONS = 3

export interface RunAndPersistOptions {
  // 実行エンジン（未指定なら利用可能なもの全部）
  engines?: EngineId[]
  // 反復回数（未指定なら共通の既定値）
  repetitions?: number
  // Scheduled scans require a paid organization owner at reservation time.
  scheduled?: boolean
}

export interface RunAndPersistResult {
  id: string
  status: 'done' | 'failed'
  summary?: Awaited<ReturnType<typeof executeScan>>['summary']
  recommendations?: Awaited<ReturnType<typeof executeScan>>['recommendations']
  error?: string
  // 失敗理由の機械可読コード（INFLIGHT=実行中で拒否 等）。呼び出し側でHTTPステータスを出し分ける用。
  code?: string
  upgradeAvailable?: boolean
}

/**
 * 1組織ぶんのスキャンを実行して永続化する。
 * 前提: 呼び出し側でブランドプロフィール設定済み・アクティブプロンプト1件以上を確認していること。
 * （未設定でも内部でチェックして failed を返すのでクラッシュはしない）
 * 組織オーナーのプラン・利用枠を実行予約と同じトランザクションで確認する。
 */
export async function runAndPersistScan(
  organizationId: string,
  opts: RunAndPersistOptions = {}
): Promise<RunAndPersistResult> {
  const [profile, prompts] = await Promise.all([
    prisma.aioBrandProfile.findUnique({ where: { organizationId } }),
    // 安定した順序で全アクティブ質問を測定する。
    prisma.aioPrompt.findMany({ where: { organizationId, isActive: true }, orderBy: { createdAt: 'asc' } }),
  ])
  if (!profile?.brandName) {
    return { id: '', status: 'failed', error: '追跡ブランドが未設定です' }
  }
  if (prompts.length === 0) {
    return { id: '', status: 'failed', error: 'アクティブな監視プロンプトがありません' }
  }

  if (prompts.length > AIO_MAX_PROMPTS_PER_SCAN) {
    return { id: '', status: 'failed', code: 'PROMPT_LIMIT',
      error: `有効な質問が${prompts.length}件あります。1回のスキャンは${AIO_MAX_PROMPTS_PER_SCAN}件までです。監視プロンプト画面で対象外の質問を無効にしてください。スキャン枠は消費していません。` }
  }

  // エンジン：利用可能なもの ∩ リクエスト（未指定なら全部）
  const avail = availableEngines()
  if (avail.length === 0) {
    return { id: '', status: 'failed', error: '利用可能なAIエンジンがありません（APIキー未設定）' }
  }
  const requested = opts.engines && opts.engines.length ? opts.engines : avail
  const engines = avail.filter((e) => requested.includes(e))
  // 交差結果が空（利用可能エンジンに無いものだけが指定された等）の場合は、
  // 0件の「成功した空スキャン」を作って枠を消費しないよう、作成前に failed を返す。
  if (engines.length === 0) {
    return { id: '', status: 'failed', error: '指定された計測エンジンが利用できません（APIキー未設定の可能性）' }
  }
  const repetitions = opts.repetitions ?? DEFAULT_REPETITIONS

  // Reserve under the organization row lock. Never hold this lock during AI calls.
  const reservation = await prisma.$transaction(async (tx) => {
    const organizations = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM aio_organizations WHERE id = ${organizationId} FOR NO KEY UPDATE
    `
    if (!organizations.length) return { kind: 'missing' } as const
    const cutoff = new Date(Date.now() - SCAN_STALE_MS)
    const inflight = await tx.aioScan.findFirst({
      where: { organizationId, status: 'processing', updatedAt: { gte: cutoff } },
      select: { id: true },
    })
    if (inflight) return { kind: 'inflight', inflight } as const
    // Expired executions must not later overwrite a replacement scan's history.
    await tx.aioScan.updateMany({
      where: { organizationId, status: 'processing', updatedAt: { lt: cutoff } },
      data: { status: 'failed', errorMessage: 'スキャンの実行期限を超過しました' },
    })
    const payer = await getAioBilling(tx, organizationId)
    if (!payer) return { kind: 'billing' } as const
    const quota = scanQuota(payer.plan)
    if (opts.scheduled && !quota.paid) return { kind: 'unpaid' } as const
    const used = await tx.aioScan.count({
      where: { organizationId, createdAt: { gte: quota.since }, status: { not: 'failed' } },
    })
    if (used >= quota.limit) return { kind: 'limit', error: quota.error, upgradeAvailable: !quota.paid } as const
    const scan = await tx.aioScan.create({
      data: { organizationId, status: 'processing', engines: engines as any, repetitions },
    })
    return { kind: 'reserved', scan } as const
  })
  if (reservation.kind === 'missing') return { id: '', status: 'failed', error: '組織が見つかりません' }
  if (reservation.kind === 'inflight') return {
    id: reservation.inflight.id, status: 'failed', code: 'INFLIGHT',
    error: 'すでにスキャンを実行中です。完了までお待ちください。',
  }
  if (reservation.kind === 'billing') return { id: '', status: 'failed', code: 'BILLING_OWNER', error: '組織の契約情報を確認できません。組織オーナーにお問い合わせください。' }
  if (reservation.kind === 'unpaid') return { id: '', status: 'failed', code: 'PAID_REQUIRED', error: '定期スキャンは有料プランの組織で利用できます。' }
  if (reservation.kind === 'limit') return { id: '', status: 'failed', code: 'LIMIT', error: reservation.error, upgradeAvailable: reservation.upgradeAvailable }
  const scan = reservation.scan

  try {
    // 2) 純ロジックでスキャン実行
    const out = await executeScan(
      {
        brandName: profile.brandName,
        brandUrl: profile.brandUrl,
        aliases: (profile.aliases as string[]) || [],
        competitors: (profile.competitors as string[]) || [],
        category: profile.category,
      },
      prompts.map((p) => ({ id: p.id, text: p.text })),
      engines,
      repetitions
    )

    // Claim completion and persist observations together. A stale/deleted scan cannot revive.
    const s = out.summary
    const saved = await prisma.$transaction(async (tx) => {
      const claimed = await tx.aioScan.updateMany({
        where: { id: scan.id, organizationId, status: 'processing',
          updatedAt: { gte: new Date(Date.now() - SCAN_STALE_MS) } },
        data: {
          status: 'done', awarenessPct: s.awarenessPct, shareOfVoice: s.shareOfVoice,
          sentimentPos: s.sentiment.positive, sentimentNeu: s.sentiment.neutral,
          sentimentNeg: s.sentiment.negative, ownCitationPct: s.ownCitationPct,
          summary: { ...s, recommendations: out.recommendations } as any,
        },
      })
      if (claimed.count !== 1) return false
      await tx.aioResult.createMany({
        data: out.runs.map((r) => ({
          organizationId, scanId: scan.id, promptId: r.promptId,
          engine: r.engine, iteration: r.iteration, brandMentioned: r.brandMentioned,
          brandRank: r.brandRank, sentiment: r.sentiment,
          competitors: r.competitors as any, citations: r.citations as any,
          answerText: r.answerText,
        })),
      })
      return true
    })
    if (!saved) {
      await prisma.aioScan.updateMany({
        where: { id: scan.id, organizationId, status: 'processing' },
        data: { status: 'failed', errorMessage: 'スキャンの実行期限を超過しました' },
      })
      return { id: scan.id, status: 'failed', code: 'EXPIRED', error: 'スキャンの実行期限を超過しました。再実行してください。' }
    }
    return { id: scan.id, status: 'done', summary: s, recommendations: out.recommendations }
  } catch (e: any) {
    // 生の例外メッセージはDB保存・クライアント返却しない（内部情報漏えい防止）。詳細はサーバログのみ。
    console.error('[aio/run] failed', e?.message)
    await prisma.aioScan
      .updateMany({
        where: { id: scan.id, organizationId, status: 'processing' },
        data: { status: 'failed', errorMessage: 'スキャンに失敗しました' },
      })
      .catch(() => {})
    return { id: scan.id, status: 'failed', error: 'スキャンに失敗しました（時間をおいて再実行してください）' }
  }
}
