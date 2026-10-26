export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST /api/support-chat/ask — サポートチャットの質問に答える
// 旗 SUPPORT_CHAT_ROLLOUT の内側（off なら 404）。ログインした人だけ。ドヤパワーは減らさない。
// 設計: docs/architecture/support-chat/SUPPORT-CHAT-2026-10-26.md
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isSupportChatEnabled } from '@/lib/support-chat/flag'
import { answerQuestion, getSupportAnswerer, mockAnswerer } from '@/lib/support-chat/answer'
import { toolIdForPath } from '@/lib/support-chat/knowledge'
import { SUPPORT_CATEGORY_LABEL } from '@/lib/support-chat/rules'
import { aiDailyLimit, ASK_DAILY_LIMIT, parseAskBody } from '@/lib/support-chat/request'
import { consumeDailyQuota, quotaSubject } from '@/lib/server-daily-quota'

export async function POST(req: NextRequest) {
  if (!(await isSupportChatEnabled())) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id ?? session?.user?.email
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const parsed = parseAskBody(await req.json().catch(() => null))
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // 1人あたり1日の上限。数えられないとき（DB の障害）は、質問は受けて有料の AI は使わない
  const mine = await consumeDailyQuota('support-chat-ask', quotaSubject(userId), ASK_DAILY_LIMIT)
  if (mine === 'limited') {
    return NextResponse.json({
      error: `今日の質問の回数（${ASK_DAILY_LIMIT}回）に達しました。お急ぎの場合は「運営に伝える」からお知らせください。`,
      limited: true,
    }, { status: 429 })
  }

  let answerer = getSupportAnswerer()
  if (answerer.paid) {
    const all = mine === 'unavailable' ? 'unavailable' : await consumeDailyQuota('support-chat-ai', 'all', aiDailyLimit())
    if (all !== 'allowed') answerer = mockAnswerer
  }

  const toolId = toolIdForPath(parsed.path)
  try {
    const res = await answerQuestion(answerer, { question: parsed.question, history: parsed.history, toolId })
    return NextResponse.json({
      kind: res.kind,
      text: res.text,
      sources: res.sources,
      category: res.kind === 'staff' ? res.category : null,
      categoryLabel: res.kind === 'staff' ? SUPPORT_CATEGORY_LABEL[res.category] : null,
    })
  } catch {
    console.error('[api/support-chat/ask] failed')
    return NextResponse.json({ error: 'いまお答えできませんでした。少し待ってからもう一度お試しいただくか、「運営に伝える」からお知らせください。' }, { status: 500 })
  }
}
