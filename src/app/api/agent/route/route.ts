export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ============================================
// POST /api/agent/route — 依頼を読んで、どのツールのどの操作で進めるかを返す（経営ホームの「ドヤAIに頼む」）
// ============================================
// 2026-10-28 本人の指示（メイン経由）。設計は src/lib/agent-router/types.ts の頭の説明。
// - AI（Claude Opus 5.5）が、操作の一覧から1つを選び、依頼の文にある値を読み取る。値はサーバーで形を確かめる。
// - 返すのは「開く画面（値を入れた URL）」と「足りない値」だけ。データは作らない。保存・送信は、開いた画面で本人が押す。
// - 複数の手順が要る依頼は plan（今までの作戦づくりへ）。どれにも合わなければ、近い操作の案を返す（行き止まりにしない）。
// - 旗（AGENT_ORCHESTRATION_ROLLOUT）が出すと決めた人でなければ 404。ログインした人だけ。ドヤパワーは減らさない。
// - 1人あたり1日 AGENT_ROUTER_USER_DAILY 回、全体で1日 AGENT_ROUTER_AI_DAILY 回まで AI を使う。超えたら・数えられないときは、
//   AI を使わずに言葉の一致で近いツールを案内する（有料の AI を使いすぎない）。
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAgentOrchestrationEnabled } from '@/lib/agent-orchestration/flag'
import { readOperationalJson } from '@/lib/operational-json'
import { consumeDailyQuota, quotaSubject } from '@/lib/server-daily-quota'
import { AGENT_ACTIONS, AGENT_PLAN_OPTIONS, routeResponse, fallbackRoute } from '@/lib/agent-router/catalog'
import { jstToday, validateReply } from '@/lib/agent-router/router'
import { askRouter } from '@/lib/agent-router/claude.server'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

function limitOf(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : fallback
}
/** 1人あたり1日の回数（既定 30） */
const userDailyLimit = () => limitOf(process.env.AGENT_ROUTER_USER_DAILY, 30)
/** 全体で1日に AI を使う回数（既定 1,000。1回 約3〜4円なので、最大で1日 約4,000円） */
const aiDailyLimit = () => limitOf(process.env.AGENT_ROUTER_AI_DAILY, 1000)

export async function POST(req: NextRequest) {
  if (!(await isAgentOrchestrationEnabled())) return NextResponse.json({ error: '見つかりません' }, { status: 404, headers: NO_STORE })
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
    return NextResponse.json({ kind: 'limited', reason: `今日、ドヤAIに頼める回数（${userDailyLimit()}回）に達しました。下のツールから直接進められます。` }, { headers: NO_STORE })
  }
  const all = mine === 'unavailable' ? 'unavailable' : await consumeDailyQuota('agent-route-ai', 'all', aiDailyLimit())
  if (all !== 'allowed') return NextResponse.json(fallbackRoute(text), { headers: NO_STORE })

  try {
    const reply = await askRouter(text, jstToday(), AGENT_ACTIONS, AGENT_PLAN_OPTIONS)
    if (reply == null) return NextResponse.json(fallbackRoute(text), { headers: NO_STORE })
    return NextResponse.json(routeResponse(validateReply(reply, AGENT_ACTIONS, AGENT_PLAN_OPTIONS), text), { headers: NO_STORE })
  } catch {
    console.error('[agent/route] router failed')
    return NextResponse.json(fallbackRoute(text), { headers: NO_STORE })
  }
}
