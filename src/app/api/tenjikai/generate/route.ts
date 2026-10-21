export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { aiGeneratePlan } from '@/lib/tenjikai/ai'
import { VENUES, type BoothPosition, type Goal, type ProjectInput } from '@/lib/tenjikai/engine'
import { privateApiJson } from '@/lib/private-api-response'
import { LifecycleError } from '@/lib/account-lifecycle/state'
import { admitGeneration, claimGeneration, degradeGeneration, finalizeGeneration, statusGeneration, validGenerationOperationId, GenerationOperationError } from '@/lib/tenjikai/generation-operation'
import { basicProjectSave, noProjectSave, unknownProjectSave, type GenerationResult, type GenerationSave } from '@/lib/tenjikai/generation-result'
import { materializeTenjikaiWorkspace, type MaterializedWorkspace } from '@/lib/tenjikai/workspace-materialize'
import { readFullTenjikaiWorkspace } from '@/lib/tenjikai/workspace-store'

// ドヤ展示会: サイト解析・ブース案・制作物の文面を LLM で作る。
// ⚠️ ログイン必須。利用枠（plan-limit.ts の tenjikaiPlans）は TenjikaiProject の作成数で数える。
//    判定と行の作成は同じトランザクション（同時に押されて上限を超えるのを防ぐ。popup/access.ts と同型）。
// 判定は LLM の前。失敗は成功風の下書きに変換しない。
// 枠はproject作成時に1回消費する。durable operationが同一再送の作成・AI再実行を止める。

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

const requestUuid = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> | null = null
  try { const parsed: unknown = await req.json(); body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null } catch {}
  const requestId = typeof body?.clientRequestId === 'string' && requestUuid.test(body.clientRequestId) ? body.clientRequestId : null
  const operationId = validGenerationOperationId(body?.operationId) ? body.operationId : null
  const expectedActor = typeof body?.expectedActor === 'string' && body.expectedActor.trim() ? body.expectedActor : null
  const reject = (status: number, state: 'rejected' | 'outcome_unknown', message: string, actorId: string | null, save: GenerationSave = noProjectSave) =>
    privateApiJson({ state, actorId, clientRequestId: requestId, operationId, projectId: null, message, save } satisfies GenerationResult, { status })
  let session: { user?: { id?: string } } | null
  try { session = await getServerSession(authOptions) as { user?: { id?: string } } | null } catch { return reject(503, 'outcome_unknown', 'ログイン状態を確認できませんでした。', null) }
  const actor = session?.user?.id
  if (!actor) return reject(401, 'rejected', 'ログインが必要です。', null)
  if (!requestId || !operationId || !expectedActor) return reject(400, 'rejected', 'リクエストの指定が正しくありません。', actor)
  if (expectedActor !== actor) return reject(409, 'rejected', 'ログイン状態が変わりました。', actor)
  const input = parseInput(body)
  if (!input) return reject(400, 'rejected', '入力内容が正しくありません。', actor)
  const stableInput = Object.freeze({ ...input })
  try {
    const admitted = await admitGeneration(actor, operationId, stableInput)
    if (admitted.quota && !admitted.quota.ok) return reject(429, 'rejected', admitted.quota.reason ?? '利用の上限に達しました。', actor)
    if (admitted.operation.state === 'deleted' || admitted.operation.state === 'superseded') return reject(409, 'rejected', '現在の案件と作成操作が一致しません。', actor)
    if (admitted.operation.state !== 'reserved') return reject(202, 'outcome_unknown', '作成操作の状態をご確認ください。再送ではAIを再実行しません。', actor, unknownProjectSave)
    const claimed = await claimGeneration(actor, operationId, stableInput)
    if (!claimed.claim) return reject(202, 'outcome_unknown', '作成操作の状態をご確認ください。再送ではAIを再実行しません。', actor, unknownProjectSave)
    const claim = claimed.claim
    let plan: Awaited<ReturnType<typeof aiGeneratePlan>> | null = null
    let workspace: MaterializedWorkspace | null = null
    try { plan = await aiGeneratePlan(stableInput); workspace = materializeTenjikaiWorkspace(stableInput, plan) }
    catch (e) { plan = null; workspace = null; console.error('[tenjikai] generate failed', { name: (e as { name?: string })?.name }) }
    let settled: Awaited<ReturnType<typeof finalizeGeneration>>
    try { settled = await finalizeGeneration(claim, workspace?.analysis ?? null, undefined, undefined, plan ? { source: plan.source, notice: plan.notice } : undefined, workspace ?? undefined) }
    catch (analysisError) {
      if (!plan) throw analysisError
      // The failed commit may have succeeded. Read the same owned operation first;
      // only a still-claimed generation can be marked analysis-unknown.
      const observed = await statusGeneration(actor, operationId)
      if (observed.state === 'completed' && observed.projectId === claim.projectId) {
        settled = { operation: observed, committed: true, workspace: await readFullTenjikaiWorkspace(actor, claim.projectId) }
      } else if (observed.state === 'processing' && observed.projectId === claim.projectId) {
        settled = { ...await degradeGeneration(claim), workspace: null }
      } else throw analysisError
    }
    if (settled.operation.state === 'deleted' || settled.operation.state === 'superseded') return reject(409, 'rejected', '現在の案件と作成操作が一致しません。', actor)
    if (!settled.committed || !['completed', 'degraded', 'failed'].includes(settled.operation.state)) return reject(202, 'outcome_unknown', '作成操作の状態をご確認ください。', actor, unknownProjectSave)
    // A result is adopted only after the final current-actor/fence status read.
    const current = await statusGeneration(actor, operationId)
    if (current.state !== settled.operation.state || current.projectId !== claim.projectId) return reject(202, 'outcome_unknown', '作成操作の状態をご確認ください。', actor, unknownProjectSave)
    if (!plan) return privateApiJson({ state: 'generation_failed', actorId: actor, clientRequestId: requestId, operationId, projectId: claim.projectId,
      message: 'AIでの作成に失敗しました。案件の基本情報は保存されています。', save: basicProjectSave } satisfies GenerationResult, { status: 502 })
    if (!settled.workspace && current.state === 'degraded') return privateApiJson({ state: 'generated', actorId: actor,
      clientRequestId: requestId, operationId, projectId: claim.projectId, plan,
      save: { ...basicProjectSave, analysis: 'unknown', plan: 'not_saved' } } satisfies GenerationResult)
    if (!settled.workspace) return reject(202, 'outcome_unknown', '保存済みの設計内容を確認できませんでした。操作の状態をご確認ください。', actor, unknownProjectSave)
    return privateApiJson({ state: 'generated', actorId: actor, clientRequestId: requestId, operationId, projectId: claim.projectId,
      plan, workspace: settled.workspace, save: { ...basicProjectSave, analysis: current.analysis, plan: 'saved' } } satisfies GenerationResult)
  } catch (e) {
    console.error('[tenjikai] generation operation failed', { code: (e as { code?: string })?.code })
    if (e instanceof LifecycleError) return reject(e.status, 'rejected', '案件の権限を確認できませんでした。', actor)
    if (e instanceof GenerationOperationError && e.status < 500) return reject(e.status, 'rejected', e.message, actor)
    return reject(503, 'outcome_unknown', '案件の作成結果を確認できませんでした。操作の状態をご確認ください。', actor, unknownProjectSave)
  }
}
