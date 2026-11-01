export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertLimitForTier, planTierOf, type QuotaResult } from '@/lib/plan-limit'
import { aiGeneratePlan } from '@/lib/tenjikai/ai'
import { VENUES, boothSize, isValidBoothMeter, mockGeneratedPlan, type BoothPosition, type Goal, type ProjectInput } from '@/lib/tenjikai/engine'

// ドヤ展示会: サイト解析・ブース案・制作物の文面を LLM で作る。
// ⚠️ ログイン必須。利用枠（plan-limit.ts の tenjikaiPlans）は TenjikaiProject の作成数で数える。
//    判定と行の作成は同じトランザクション（同時に押されて上限を超えるのを防ぐ。popup/access.ts と同型）。
// ⚠️ 判定は LLM の**前**。DB に書けない（tenjikai_* 未反映など）ときは LLM を呼ばずにモックを返す。
// ⚠️ LLM が失敗したらモックを返す。枠は作成した時点で1回分として数える（失敗の繰り返しで無料枠を回避されないように）。

const POSITIONS: BoothPosition[] = ['inline', 'corner', 'peninsula', 'island']
const GOALS: Goal[] = ['lead', 'brand', 'demo']
const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null)

function parseInput(b: any): ProjectInput | null {
  if (!b || typeof b !== 'object') return null
  const serviceUrl = typeof b.serviceUrl === 'string' ? b.serviceUrl.trim().slice(0, 500) : ''
  const eventName = typeof b.eventName === 'string' ? b.eventName.trim().slice(0, 120) : ''
  const eventStart = typeof b.eventStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.eventStart) ? b.eventStart : ''
  const days = int(b.days, 1, 14)
  const komaCols = int(b.komaCols, 1, 10)
  const komaRows = int(b.komaRows, 1, 10)
  const budgetYen = int(b.budgetYen, 0, 1_000_000_000)
  const staff = int(b.staff, 1, 100)
  if (!serviceUrl || !eventName || !eventStart || Number.isNaN(Date.parse(eventStart))) return null
  if (days == null || komaCols == null || komaRows == null || budgetYen == null || staff == null) return null
  if (!VENUES.some((v) => v.id === b.venueId) || !POSITIONS.includes(b.position) || !GOALS.includes(b.goal)) return null
  // 小間の横と奥行（m）。画面と同じ決まり（1〜30m・0.5m 刻み。engine.ts の isValidBoothMeter）。
  // 前の版の画面から来たときは無いので、そのときは小間の列と行から決める。片方だけ・範囲の外は受け付けない
  const hasSize = b.widthM !== undefined || b.depthM !== undefined
  if (hasSize && !(isValidBoothMeter(b.widthM) && isValidBoothMeter(b.depthM))) return null
  const size = hasSize ? { widthM: b.widthM as number, depthM: b.depthM as number } : {}
  return { serviceUrl, eventName, venueId: b.venueId, eventStart, days, komaCols, komaRows, ...size, position: b.position, budgetYen, goal: b.goal, staff }
}

async function createProjectWithinQuota(userId: string, input: ProjectInput): Promise<{ ok: true; projectId: string } | { ok: false; quota: QuotaResult }> {
  // ⚠️ プランはトランザクションの外で引く（中で別の問い合わせをすると接続待ちで固まる）
  const tier = await planTierOf(userId)
  const { w, d } = boothSize(input)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const quota = await assertLimitForTier(
            'tenjikaiPlans',
            tier,
            () => tx.tenjikaiProject.count({ where: { userId } }),
            (since) => tx.tenjikaiProject.count({ where: { userId, createdAt: { gte: since } } })
          )
          if (!quota.ok) return { ok: false as const, quota }
          const project = await tx.tenjikaiProject.create({
            data: {
              userId,
              name: input.eventName,
              serviceUrl: input.serviceUrl,
              eventName: input.eventName,
              eventStart: new Date(`${input.eventStart}T00:00:00+09:00`),
              eventDays: input.days,
              komaCols: input.komaCols,
              komaRows: input.komaRows,
              boothWidthM: w,
              boothDepthM: d,
              boothPosition: input.position,
              budgetYen: input.budgetYen,
              goal: input.goal,
              staffCount: input.staff,
              status: 'planning',
            },
            select: { id: true },
          })
          return { ok: true as const, projectId: project.id }
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })

  const input = parseInput(await req.json().catch(() => null))
  if (!input) return NextResponse.json({ error: '入力内容が正しくありません。' }, { status: 400 })

  let created: Awaited<ReturnType<typeof createProjectWithinQuota>>
  try {
    created = await createProjectWithinQuota(userId, input)
  } catch (e) {
    console.error('[tenjikai] quota/project create failed', { code: (e as { code?: string })?.code })
    return NextResponse.json(mockGeneratedPlan(input, '利用枠を確認できなかったため、下書きを表示しています。'))
  }
  if (!created.ok) return NextResponse.json({ error: created.quota.reason ?? '利用の上限に達しました。' }, { status: 429 })

  try {
    const plan = await aiGeneratePlan(input)
    // 解析結果は案件に残す（失敗しても画面には返す）
    await prisma.tenjikaiSiteAnalysis
      .create({
        data: {
          projectId: created.projectId,
          brand: plan.analysis.brand,
          category: plan.analysis.category,
          headline: plan.analysis.headline,
          subline: plan.analysis.subline,
          valueProps: plan.analysis.valueProps,
          targets: plan.analysis.targets,
          brandColors: plan.analysis.colors,
          tone: plan.analysis.tone,
        },
      })
      .catch((e) => console.warn('[tenjikai] analysis save failed', { code: (e as { code?: string })?.code }))
    return NextResponse.json({ ...plan, projectId: created.projectId })
  } catch (e) {
    console.error('[tenjikai] generate failed', { name: (e as { name?: string })?.name })
    return NextResponse.json({ ...mockGeneratedPlan(input, 'AIでの作成に失敗したため、下書きを表示しています。'), projectId: created.projectId })
  }
}
