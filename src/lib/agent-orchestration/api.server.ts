// ============================================
// エージェントの API の共通の入口（旗 → 記録の設定 → ログイン）と、失敗の答え
// ============================================
// ⚠️ 旗（AGENT_ORCHESTRATION_ROLLOUT）を最初に見る。off ならセッションも読まずに 404。
// ⚠️ 記録の API は、AGENT_RUNS_STORE=db でなければ 404 { store: 'off' }（表に触れない）。
import { NextResponse } from 'next/server'
import { isAgentOrchestrationEnabled } from './flag'
import { agentRunsStoreEnabled } from './store-flag'
import { AgentTaskError, failureText } from './runner'

export const NO_STORE = { 'Cache-Control': 'private, no-store' }

export const notFound = () => NextResponse.json({ error: '見つかりません' }, { status: 404, headers: NO_STORE })

/** 旗・記録の設定・ログインを順に確かめる。通れば userId、通らなければ返す答え */
export async function agentGate(opts: { store: boolean }): Promise<{ userId: string } | { response: Response }> {
  if (!(await isAgentOrchestrationEnabled())) return { response: notFound() }
  if (opts.store && !agentRunsStoreEnabled()) return { response: NextResponse.json({ error: '見つかりません', store: 'off' }, { status: 404, headers: NO_STORE }) }
  const { currentUserId } = await import('@/lib/shell/company.server')
  const userId = await currentUserId()
  if (!userId) return { response: NextResponse.json({ error: 'ログインしてください。', kind: 'auth' }, { status: 401, headers: NO_STORE }) }
  return { userId }
}

/** ToDo の失敗の答え（422）。内部の失敗の文は出さない */
export function taskFailure(e: unknown, extra: Record<string, unknown> = {}) {
  const err = e instanceof AgentTaskError ? e : null
  if (!err) console.error('[agent] task failed')
  return NextResponse.json(
    { error: failureText(e), kind: err?.kind ?? 'tool', resume: err?.resume, href: err?.href, power: err?.power, cause: err?.cause, actions: err?.actions, ...extra },
    { status: 422, headers: NO_STORE },
  )
}
