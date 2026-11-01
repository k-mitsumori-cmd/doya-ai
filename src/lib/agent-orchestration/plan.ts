// ============================================
// 作戦づくり（組み合わせから作る・AI の答えを検査する）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §4
// - 段階1（いま）: 決まった組み合わせ（recipes.ts）と質問の答えから、AI を使わずに作戦を作る（planFromRecipe）。
// - 段階2: AI が返した作戦の JSON を、決まった操作の表（ACTION_CATALOG）で検査する（sanitizeAiPlan）。
//   表に無い操作・知らない順番・循環は捨てる。減るドヤパワーは AI ではなく costs.ts から計算する。
// ⚠️ 画面とサーバーの両方が使う。秘密や DB の処理は書かない。
import { doyaPowerCost, type DoyaPowerAction } from '@/lib/doya-power/costs'
import { validateTasks } from './runner'
import type { AgentRecipe, SalesPrepAnswers } from './recipes'
import { AGENT_CONTRACT_VERSION, type AgentActionId, type AgentPillar, type AgentPlan, type AgentPlanTask, type AgentReadiness } from './types'

/** 実行できる操作の表。power は、各ツールのルートが withDoyaPowerCharge で減らす操作の名前（減らさないものは null） */
export const ACTION_CATALOG: Record<AgentActionId, { tool: string; toolName: string; powerAction: DoyaPowerAction | null; minutes: number }> = {
  // 商談準備は、ドヤパワーではなく、商談準備の月の件数で数える（ルートに包みが無い）
  'shodan.research': { tool: 'shodan', toolName: 'ドヤ商談準備', powerAction: null, minutes: 2 },
  // 見積の品目の案（suggest）が text.generate。見積書の保存は減らない
  'quote.draft': { tool: 'quote', toolName: 'ドヤ見積もりAI', powerAction: 'text.generate', minutes: 1 },
  // スライドの構成（structure）が slide.generate
  'slide.structure': { tool: 'doyaslide', toolName: 'ドヤスライド', powerAction: 'slide.generate', minutes: 2 },
}

export const isAgentAction = (v: unknown): v is AgentActionId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(ACTION_CATALOG, v)

/** 操作の減るドヤパワー（表から。減らない操作は 0） */
export function actionPower(action: AgentActionId): number {
  const p = ACTION_CATALOG[action].powerAction
  return p ? doyaPowerCost(p) ?? 0 : 0
}

const MAX_CONCURRENCY = 3

/** 決まった組み合わせと答えから、作戦を作る（AI を使わない）。readiness はツールごとの準備（sources.ts が読む） */
export function planFromRecipe(recipe: AgentRecipe, a: SalesPrepAnswers, ctx: { readiness?: Record<string, AgentReadiness>; companyName?: string | null } = {}): AgentPlan {
  const ready = (tool: string): AgentReadiness => ctx.readiness?.[tool] ?? { ok: true }
  const tasks: AgentPlanTask[] = recipe.tasks.map((t) => ({
    id: t.id,
    action: t.action,
    tool: ACTION_CATALOG[t.action].tool,
    toolName: t.toolName,
    title: t.label(a),
    makes: t.makes,
    uses: t.uses,
    power: actionPower(t.action),
    minutes: ACTION_CATALOG[t.action].minutes,
    after: t.dependsOn ?? [],
    stages: t.stages(a),
    delegable: true,
    delegate: ready(ACTION_CATALOG[t.action].tool).ok,
    ready: ready(ACTION_CATALOG[t.action].tool),
  }))
  const pillars: AgentPillar[] = recipe.pillars.map((p) => ({
    id: p.id, name: p.name, why: p.why, teamGoal: p.teamGoal(a),
    tasks: tasks.filter((t) => recipe.tasks.find((r) => r.id === t.id)?.pillar === p.id),
  }))
  const g = recipe.goal(a)
  const missingTools = [...new Set(tasks.filter((t) => !t.ready.ok).map((t) => t.toolName))]
  return {
    version: AGENT_CONTRACT_VERSION,
    source: 'recipe',
    recipeId: recipe.id,
    goal: { ...g, period: recipe.period, now: 0, target: tasks.length, gap: tasks.length },
    reasons: recipe.reasons(a, { missingTools, companyName: ctx.companyName ?? null }),
    pillars,
    totalPower: delegatedPower(tasks),
    concurrency: MAX_CONCURRENCY,
  }
}

/** 任せる ToDo の減る量の合計 */
export function delegatedPower(tasks: Pick<AgentPlanTask, 'power' | 'delegate'>[]): number {
  return tasks.reduce((s, t) => s + (t.delegate ? t.power : 0), 0)
}

/** 作戦の中のタスクを、平らな一覧にする（runner に渡す形） */
export function planTasks(plan: AgentPlan): (AgentPlanTask & { dependsOn: string[] })[] {
  return plan.pillars.flatMap((p) => p.tasks).map((t) => ({ ...t, dependsOn: t.after }))
}

const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/**
 * AI が返した作戦の JSON を検査する（段階2で使う）。
 * - 操作が表に無いタスク・題の無いタスクは捨てる。id が重なれば捨てる。
 * - after は、残ったタスクの id だけにする。循環があれば after をすべて外す（同時に動かす）。
 * - power と tool は表から決める（AI の値を使わない）。タスクは最大 maxTasks まで。
 * - 柱が空になったら捨てる。タスクが1つも残らなければ null。
 */
export function sanitizeAiPlan(raw: unknown, opts: { recipeId?: string; maxTasks?: number; stagesOf?: (t: { action: AgentActionId; title: string }) => string[] } = {}): AgentPlan | null {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const max = opts.maxTasks ?? 8
  const seen = new Set<string>()
  const pillarsIn = Array.isArray(r.pillars) ? r.pillars.slice(0, 5) : []
  let count = 0
  const pillars: AgentPillar[] = []
  pillarsIn.forEach((pv, pi) => {
    const p = (pv && typeof pv === 'object' ? pv : {}) as Record<string, unknown>
    const tasks: AgentPlanTask[] = []
    for (const tv of Array.isArray(p.tasks) ? p.tasks : []) {
      if (count >= max) break
      const t = (tv && typeof tv === 'object' ? tv : {}) as Record<string, unknown>
      const title = text(t.title, 120)
      if (!isAgentAction(t.action) || !title) continue
      let id = typeof t.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(t.id) ? t.id : `t${count + 1}`
      if (seen.has(id)) id = `t${count + 1}-${pi}`
      if (seen.has(id)) continue
      seen.add(id)
      count++
      const c = ACTION_CATALOG[t.action]
      const minutes = typeof t.minutes === 'number' && t.minutes > 0 && t.minutes <= 60 ? Math.round(t.minutes) : c.minutes
      tasks.push({
        id, action: t.action, tool: c.tool, toolName: c.toolName, title,
        makes: text(t.makes, 120) ?? '', uses: '', power: actionPower(t.action), minutes,
        after: Array.isArray(t.after) ? t.after.filter((x): x is string => typeof x === 'string') : [],
        stages: opts.stagesOf?.({ action: t.action, title }) ?? [title, '仕上げています'],
        delegable: true, delegate: true, ready: { ok: true },
      })
    }
    if (tasks.length) pillars.push({ id: text(p.id, 40) ?? `p${pi + 1}`, name: text(p.name, 40) ?? `柱${pi + 1}`, why: text(p.why, 200) ?? '', teamGoal: text(p.teamGoal, 80) ?? '', tasks })
  })
  const all = pillars.flatMap((p) => p.tasks)
  if (!all.length) return null
  for (const t of all) t.after = t.after.filter((d) => d !== t.id && seen.has(d))
  if (validateTasks(all.map((t) => ({ id: t.id, dependsOn: t.after })))) for (const t of all) t.after = []
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null)
  const g = (r.goal && typeof r.goal === 'object' ? r.goal : { statement: r.goal }) as Record<string, unknown>
  const now = num(g.now) ?? 0
  const target = num(g.target) ?? all.length
  return {
    version: AGENT_CONTRACT_VERSION,
    source: 'ai',
    recipeId: opts.recipeId ?? 'ai',
    goal: { statement: text(g.statement, 120) ?? '依頼を進める', period: text(r.period, 40) ?? '', measure: text(g.measure, 40) ?? 'ToDo', unit: text(g.unit, 8) ?? '件', now, target, gap: Math.max(0, target - now) },
    reasons: (Array.isArray(r.reasons) ? r.reasons : []).map((x) => text(x, 120)).filter((x): x is string => !!x).slice(0, 5),
    pillars,
    totalPower: delegatedPower(all),
    concurrency: MAX_CONCURRENCY,
  }
}
