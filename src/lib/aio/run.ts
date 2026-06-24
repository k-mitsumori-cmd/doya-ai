// ============================================
// ドヤAIO スキャン永続化の共通ロジック
// AioScan(processing) 作成 → executeScan 実行 → AioResult 一括保存
// → AioScan を done/failed に更新、まで一連を担当する。
// scans/route.ts（手動実行）と cron/aio-scan（定期実行）の両方から呼ぶ。
// ============================================
import { prisma } from '@/lib/prisma'
import { availableEngines, SCAN_STALE_MS, type EngineId } from '@/lib/aio/types'
import { executeScan } from '@/lib/aio/scan'

// 反復回数はプランで差別化しない（無料・プロ共通）。
// プランの差は「調査回数（スキャン頻度）」と「閲覧できる範囲」で付ける。
const DEFAULT_REPETITIONS = 3

// 1スキャンのコスト暴発を防ぐハードキャップ。
// 実行ジョブ総数 = 使用プロンプト数 × エンジン数 × 反復。これを超えないようプロンプト件数を頭打ちにする。
// （無料はプロンプト登録3件・有料は無制限登録だが、1スキャンで投げる件数はここで制限する）
const MAX_PROMPTS_PER_SCAN = 30

export interface RunAndPersistOptions {
  // 実行エンジン（未指定なら利用可能なもの全部）
  engines?: EngineId[]
  // 反復回数（未指定なら共通の既定値）
  repetitions?: number
}

export interface RunAndPersistResult {
  id: string
  status: 'done' | 'failed'
  summary?: Awaited<ReturnType<typeof executeScan>>['summary']
  recommendations?: Awaited<ReturnType<typeof executeScan>>['recommendations']
  error?: string
  // 失敗理由の機械可読コード（INFLIGHT=実行中で拒否 等）。呼び出し側でHTTPステータスを出し分ける用。
  code?: string
}

/**
 * 1組織ぶんのスキャンを実行して永続化する。
 * 前提: 呼び出し側でブランドプロフィール設定済み・アクティブプロンプト1件以上を確認していること。
 * （未設定でも内部でチェックして failed を返すのでクラッシュはしない）
 * プラン制限（無料は週1回など）は呼び出し側の責務。ここでは行わない。
 */
export async function runAndPersistScan(
  organizationId: string,
  opts: RunAndPersistOptions = {}
): Promise<RunAndPersistResult> {
  const [profile, prompts] = await Promise.all([
    prisma.aioBrandProfile.findUnique({ where: { organizationId } }),
    prisma.aioPrompt.findMany({ where: { organizationId, isActive: true } }),
  ])
  if (!profile?.brandName) {
    return { id: '', status: 'failed', error: '追跡ブランドが未設定です' }
  }
  if (prompts.length === 0) {
    return { id: '', status: 'failed', error: 'アクティブな監視プロンプトがありません' }
  }

  // 同一組織で既にスキャン実行中なら二重実行を拒否（連打・cron重複によるコスト暴発防止）。
  // maxDuration(300s)で打ち切られた幽霊processingは stale 扱いで除外し、再実行を妨げない。
  const inflight = await prisma.aioScan.findFirst({
    where: { organizationId, status: 'processing', updatedAt: { gte: new Date(Date.now() - SCAN_STALE_MS) } },
    select: { id: true },
  })
  if (inflight) {
    return { id: inflight.id, status: 'failed', error: 'すでにスキャンを実行中です。完了までお待ちください。', code: 'INFLIGHT' }
  }

  // コスト上限: 1スキャンで投げるプロンプトは MAX_PROMPTS_PER_SCAN 件まで（超過分は次回以降）。
  const cappedPrompts = prompts.length > MAX_PROMPTS_PER_SCAN ? prompts.slice(0, MAX_PROMPTS_PER_SCAN) : prompts
  if (cappedPrompts.length < prompts.length) {
    console.warn(`[aio/run] org=${organizationId} プロンプト${prompts.length}件中 上限${MAX_PROMPTS_PER_SCAN}件のみスキャン`)
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

  // 1) processing でスキャンレコードを作成
  const scan = await prisma.aioScan.create({
    data: {
      organizationId,
      status: 'processing',
      engines: engines as any,
      repetitions,
    },
  })

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
      cappedPrompts.map((p) => ({ id: p.id, text: p.text })),
      engines,
      repetitions
    )

    // 3) 個別ラン結果を保存（部分永続化の取りこぼしを防ぐため try/catch）
    try {
      await prisma.aioResult.createMany({
        data: out.runs.map((r) => ({
          organizationId,
          scanId: scan.id,
          promptId: r.promptId,
          engine: r.engine,
          iteration: r.iteration,
          brandMentioned: r.brandMentioned,
          brandRank: r.brandRank,
          sentiment: r.sentiment,
          competitors: r.competitors as any,
          citations: r.citations as any,
          answerText: r.answerText,
        })),
      })
    } catch (persistErr: any) {
      // 生の例外メッセージ(接続文字列/スキーマ等を含みうる)はDBに保存せず汎用文言のみ。詳細はサーバログのみ。
      console.error('[aio/run] createMany failed', persistErr?.message)
      await prisma.aioScan
        .update({
          where: { id: scan.id },
          data: { status: 'failed', errorMessage: '個別結果の保存に失敗しました' },
        })
        .catch(() => {})
      return { id: scan.id, status: 'failed', error: '個別結果の保存に失敗しました' }
    }

    // 4) サマリを保存して done に
    const s = out.summary
    const updated = await prisma.aioScan.update({
      where: { id: scan.id },
      data: {
        status: 'done',
        awarenessPct: s.awarenessPct,
        shareOfVoice: s.shareOfVoice,
        sentimentPos: s.sentiment.positive,
        sentimentNeu: s.sentiment.neutral,
        sentimentNeg: s.sentiment.negative,
        ownCitationPct: s.ownCitationPct,
        summary: { ...s, recommendations: out.recommendations } as any,
      },
    })
    return { id: updated.id, status: 'done', summary: s, recommendations: out.recommendations }
  } catch (e: any) {
    // 生の例外メッセージはDB保存・クライアント返却しない（内部情報漏えい防止）。詳細はサーバログのみ。
    console.error('[aio/run] failed', e?.message)
    await prisma.aioScan
      .update({
        where: { id: scan.id },
        data: { status: 'failed', errorMessage: 'スキャンに失敗しました' },
      })
      .catch(() => {})
    return { id: scan.id, status: 'failed', error: 'スキャンに失敗しました（時間をおいて再実行してください）' }
  }
}
