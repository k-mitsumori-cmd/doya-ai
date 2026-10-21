export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertLimitForTier, planTierOf, type QuotaResult } from '@/lib/plan-limit'
import { aiGeneratePlan } from '@/lib/tenjikai/ai'
import { VENUES, boothSize, type BoothPosition, type Goal, type ProjectInput, type GeneratedPlan } from '@/lib/tenjikai/engine'
import { privateApiJson } from '@/lib/private-api-response'
import { lockLifecycleUsers, assertLifecycleWritable } from '@/lib/account-lifecycle/store'
import { LifecycleError } from '@/lib/account-lifecycle/state'
import { basicProjectSave, noProjectSave, unknownProjectSave, type GenerationResult, type GenerationSave } from '@/lib/tenjikai/generation-result'

// ドヤ展示会: サイト解析・ブース案・制作物の文面を LLM で作る。
// ⚠️ ログイン必須。利用枠（plan-limit.ts の tenjikaiPlans）は TenjikaiProject の作成数で数える。
//    判定と行の作成は同じトランザクション（同時に押されて上限を超えるのを防ぐ。popup/access.ts と同型）。
// 判定は LLM の前。失敗は成功風の下書きに変換しない。
// 枠はproject作成時に1回消費する（c3bで再送回復を実装するまで自動再送しない）。

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
  const calendarDate = new Date(`${eventStart}T00:00:00Z`)
  if (!serviceUrl || !eventName || !eventStart || !Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== eventStart) return null
  if (days == null || komaCols == null || komaRows == null || budgetYen == null || staff == null) return null
  if (!VENUES.some((v) => v.id === b.venueId) || !POSITIONS.includes(b.position) || !GOALS.includes(b.goal)) return null
  return { serviceUrl, eventName, venueId: b.venueId, eventStart, days, komaCols, komaRows, position: b.position, budgetYen, goal: b.goal, staff }
}

async function createProjectWithinQuota(userId: string, input: ProjectInput): Promise<{ ok: true; projectId: string } | { ok: false; quota: QuotaResult }> {
  const { w, d } = boothSize(input)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await lockLifecycleUsers(tx, [userId])
          await assertLifecycleWritable(tx, [userId])
          const tier = await planTierOf(userId, tx)
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
      // 直列化/デッドロックだけTx全体を再試行。P2028/接続喪失はcommit不明もあり再作成しない。
      const code = (e as { code?: string })?.code
      const sqlstate = (e as { meta?: { code?: string } })?.meta?.code
      if (code !== 'P2034' && !(code === 'P2010' && (sqlstate === '40001' || sqlstate === '40P01')) || attempt === 4) throw e
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1) + Math.floor(Math.random() * 200)))
    }
  }
  throw new Error('unreachable')
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> | null = null
  try {
    const parsed: unknown = await req.json()
    body = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch { /* malformed body is a 400 */ }
  const requestId = typeof body?.clientRequestId === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(body.clientRequestId) ? body.clientRequestId : null
  const expectedActor = typeof body?.expectedActor === 'string' && body.expectedActor.trim() ? body.expectedActor : null
  const reject = (status: number, state: 'rejected' | 'outcome_unknown', message: string, actorId: string | null, save: GenerationSave = noProjectSave) =>
    privateApiJson({ state, actorId, clientRequestId: requestId, projectId: null, message, save } satisfies GenerationResult, { status })

  let session: { user?: { id?: string } } | null
  try { session = await getServerSession(authOptions) as { user?: { id?: string } } | null } catch { return reject(503, 'outcome_unknown', 'ログイン状態を確認できませんでした。', null) }
  const userId = session?.user?.id
  if (!userId) return reject(401, 'rejected', 'ログインが必要です。', null)
  if (!requestId || !expectedActor) return reject(400, 'rejected', 'リクエストの指定が正しくありません。', userId)
  if (expectedActor !== userId) return reject(409, 'rejected', 'ログイン状態が変わりました。', userId)
  const input = parseInput(body)
  if (!input) return reject(400, 'rejected', '入力内容が正しくありません。', userId)

  let created: Awaited<ReturnType<typeof createProjectWithinQuota>>
  try {
    created = await createProjectWithinQuota(userId, input)
  } catch (e) {
    console.error('[tenjikai] quota/project create failed', { code: (e as { code?: string })?.code, sqlstate: (e as { meta?: { code?: string } })?.meta?.code })
    if (e instanceof LifecycleError) return reject(e.status, 'rejected', e.message, userId)
    return reject(503, 'outcome_unknown', '案件の作成結果を確認できませんでした。再度作成せず、保存状況をご確認ください。', userId, unknownProjectSave)
  }
  if (!created.ok) return reject(429, 'rejected', created.quota.reason ?? '利用の上限に達しました。', userId)

  const owned = async (tx: Prisma.TransactionClient) => {
    await lockLifecycleUsers(tx, [userId])
    await assertLifecycleWritable(tx, [userId])
    return tx.tenjikaiProject.findFirst({ where: { id: created.projectId, userId }, select: { id: true } })
  }
  const verifyOwned = () => prisma.$transaction(async tx => {
    if (!await owned(tx)) throw new LifecycleError('TENJIKAI_PROJECT_UNAVAILABLE')
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 })
  let plan: GeneratedPlan
  try {
    plan = await aiGeneratePlan(input)
  } catch (e) {
    console.error('[tenjikai] generate failed', { name: (e as { name?: string })?.name })
    try { await verifyOwned() } catch (checkError) {
      return reject(checkError instanceof LifecycleError ? checkError.status : 503,
        checkError instanceof LifecycleError ? 'rejected' : 'outcome_unknown',
        '案件の権限または保存状態を確認できませんでした。', userId, unknownProjectSave)
    }
    return privateApiJson({ state: 'generation_failed', actorId: userId, clientRequestId: requestId, projectId: created.projectId,
      message: 'AIでの作成に失敗しました。案件の基本情報は保存されています。', save: basicProjectSave } satisfies GenerationResult, { status: 502 })
  }
  // AIはTx外。採用時はUser→所有project順に再確認し、退会fenceがあれば書かない。
  const analysisData = {
          projectId: created.projectId,
          brand: plan.analysis.brand,
          category: plan.analysis.category,
          headline: plan.analysis.headline,
          subline: plan.analysis.subline,
          valueProps: plan.analysis.valueProps,
          targets: plan.analysis.targets,
          brandColors: plan.analysis.colors,
          tone: plan.analysis.tone,
  }
  let analysis: GenerationSave['analysis'] = 'unknown'
  try {
    await prisma.$transaction(async tx => {
      if (!await owned(tx)) throw new LifecycleError('TENJIKAI_PROJECT_UNAVAILABLE')
      await tx.tenjikaiSiteAnalysis.create({ data: analysisData })
    }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 })
    analysis = 'saved'
  } catch (e) {
    console.warn('[tenjikai] analysis save not confirmed', { code: (e as { code?: string })?.code })
    if (e instanceof LifecycleError) return reject(e.status, 'rejected', '案件の権限を確認できませんでした。', userId, unknownProjectSave)
    // 例外だけで未保存とは断定しない。今回新規作成したprojectの同内容だけを照合する。
    try {
      analysis = await prisma.$transaction(async tx => {
        if (!await owned(tx)) throw new LifecycleError('TENJIKAI_PROJECT_UNAVAILABLE')
        const row = await tx.tenjikaiSiteAnalysis.findUnique({ where: { projectId: created.projectId }, select: {
          brand: true, category: true, headline: true, subline: true, valueProps: true, targets: true, brandColors: true, tone: true,
        } })
        return row && row.brand === analysisData.brand && row.category === analysisData.category && row.headline === analysisData.headline
          && row.subline === analysisData.subline && JSON.stringify(row.valueProps) === JSON.stringify(analysisData.valueProps)
          && JSON.stringify(row.targets) === JSON.stringify(analysisData.targets) && JSON.stringify(row.brandColors) === JSON.stringify(analysisData.brandColors)
          && row.tone === analysisData.tone ? 'saved' : 'unknown'
      }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 })
    } catch (readError) {
      if (readError instanceof LifecycleError) return reject(readError.status, 'rejected', '案件の権限を確認できませんでした。', userId, unknownProjectSave)
    }
  }
  try {
    await verifyOwned()
  } catch (e) {
    if (e instanceof LifecycleError) return reject(e.status, 'rejected', '案件の権限を確認できませんでした。', userId, unknownProjectSave)
    return reject(503, 'outcome_unknown', '案件の保存状態を確認できませんでした。再度作成せず、保存状況をご確認ください。', userId, unknownProjectSave)
  }
  return privateApiJson({ state: 'generated', actorId: userId, clientRequestId: requestId, projectId: created.projectId, plan,
    save: { ...basicProjectSave, analysis } } satisfies GenerationResult)
}
