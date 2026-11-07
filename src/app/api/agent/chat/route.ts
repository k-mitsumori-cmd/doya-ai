export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ============================================
// POST /api/agent/chat — 依頼を読んで、チャットで進める操作か、今の案内かを返す（右下の「ドヤAIに頼む」の会話）
// ============================================
// 設計: docs/architecture/agent-chat/DESIGN-2026-11-05.md
// ⚠️ ここは DB に業務データを書かない（書くのは使用回数の記録だけ）。保存は、ツールの画面の送信処理が、本人の確認ボタンのあとに行う。
// - 旗 AGENT_CHAT_ROLLOUT が出すと決めた人だけ（それ以外は 404）。ログインした人だけ。ドヤパワーは減らさない。
// - 回数は /api/agent/route と同じ枠（1人1日 AGENT_ROUTER_USER_DAILY 回、全体 AGENT_ROUTER_AI_DAILY 回）。超えたら・数えられないときは、AI を使わずに言葉の一致で案内する。
// - チャットで進める操作（ops.ts）に当たったら values を依頼の文で確かめて返す。それ以外は今の /api/agent/route と同じ形で返す。
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readOperationalJson } from '@/lib/operational-json'
import { consumeDailyQuota, quotaSubject } from '@/lib/server-daily-quota'
import { AGENT_PLAN_OPTIONS, fallbackRoute } from '@/lib/agent-router/catalog'
import { jstToday, validateReply } from '@/lib/agent-router/router'
import { askRouter } from '@/lib/agent-router/claude.server'
import { isAgentChatEnabled } from '@/lib/agent-chat/flag'
import { chatActions, chatResponse } from '@/lib/agent-chat/handle'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

function limitOf(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : fallback
}
const userDailyLimit = () => limitOf(process.env.AGENT_ROUTER_USER_DAILY, 30)
const aiDailyLimit = () => limitOf(process.env.AGENT_ROUTER_AI_DAILY, 300)

export async function POST(req: NextRequest) {
  if (!(await isAgentChatEnabled())) return NextResponse.json({ error: '見つかりません' }, { status: 404, headers: NO_STORE })
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id ?? session?.user?.email
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401, headers: NO_STORE })

  let text = ''
  try {
    const body = await readOperationalJson(req, 8 * 1024)
    text = typeof body.text === 'string' ? body.text.trim().slice(0, 500) : ''
  } catch {
    return NextResponse.json({ error: '送った内容を読めませんでした。' }, { status: 400, headers: NO_STORE })
  }
  if (!text) return NextResponse.json({ error: 'やりたいことを書いてください。' }, { status: 400, headers: NO_STORE })

  const mine = await consumeDailyQuota('agent-route-user', quotaSubject(userId), userDailyLimit())
  if (mine === 'limited') {
    return NextResponse.json({ kind: 'limited', reason: `今日、ドヤAIに頼める回数（${userDailyLimit()}回）に達しました。明日また頼めます。今日は、それぞれのツールの画面から直接進められます。` }, { headers: NO_STORE })
  }
  const all = mine === 'unavailable' ? 'unavailable' : await consumeDailyQuota('agent-route-ai', 'all', aiDailyLimit())
  if (all !== 'allowed') return NextResponse.json(fallbackRoute(text), { headers: NO_STORE })

  try {
    const actions = chatActions()
    const reply = await askRouter(text, jstToday(), actions, AGENT_PLAN_OPTIONS)
    if (reply == null) return NextResponse.json(fallbackRoute(text), { headers: NO_STORE })
    return NextResponse.json(chatResponse(validateReply(reply, actions, AGENT_PLAN_OPTIONS), text), { headers: NO_STORE })
  } catch {
    console.error('[agent/chat] router failed')
    return NextResponse.json(fallbackRoute(text), { headers: NO_STORE })
  }
}
