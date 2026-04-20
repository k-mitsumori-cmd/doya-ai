/**
 * POST /api/allinone/analysis/[id]/chat
 * 分析結果コンテキストを踏まえて Claude とチャット。
 * SSE でトークンをストリーム配信。
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSseStream, SSE_HEADERS } from '@/lib/allinone/sse'
import { streamClaude } from '@/lib/allinone/claude'
import { SYSTEM_CHAT_BASE, SYSTEM_CHAT_VERBOSE } from '@/lib/allinone/prompts'
import type { ChatSseEvent } from '@/lib/allinone/types'

export const runtime = 'nodejs'
export const maxDuration = 180
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const analysisId = params.id
  let body: { question?: string; verbose?: boolean; focusSection?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }
  const question = (body.question || '').trim()
  if (!question) {
    return new Response(JSON.stringify({ error: 'question is required' }), { status: 400 })
  }

  const analysis = await prisma.allinoneAnalysis.findUnique({
    where: { id: analysisId },
    include: { chats: { orderBy: { createdAt: 'asc' }, take: 40 } },
  })
  if (!analysis) return new Response('not found', { status: 404 })

  // コンテキスト生成
  const ctxJson = {
    url: analysis.url,
    title: analysis.title,
    description: analysis.description,
    overallScore: analysis.overallScore,
    radar: analysis.radar,
    summary: analysis.summary,
    siteAnalysis: analysis.siteAnalysis,
    seoAnalysis: analysis.seoAnalysis,
    personas: analysis.personas,
    branding: analysis.branding,
    keyVisuals: analysis.keyVisuals,
    actionPlan: analysis.actionPlan,
  }

  const focus = body.focusSection ? `\n【ユーザーは今 ${body.focusSection} タブを見ています】` : ''
  const system =
    (body.verbose ? SYSTEM_CHAT_VERBOSE : SYSTEM_CHAT_BASE) +
    `\n\n## 診断結果（JSON）\n\`\`\`json\n${JSON.stringify(ctxJson).slice(0, 12000)}\n\`\`\`` +
    focus

  // 過去チャットを messages に反映
  const messages = [
    ...analysis.chats.map((c) => ({
      role: c.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: c.content,
    })),
    { role: 'user' as const, content: question },
  ]

  // ユーザーメッセージを先に保存
  await prisma.allinoneChat.create({
    data: {
      analysisId,
      role: 'user',
      content: question,
      verbose: Boolean(body.verbose),
    },
  })

  const stream = createSseStream<ChatSseEvent>(async (ctrl) => {
    try {
      const result = await streamClaude(
        {
          systemPrompt: system,
          messages,
          model: 'power',
          maxTokens: body.verbose ? 2500 : 1200,
          temperature: 0.7,
        },
        (t) => ctrl.send({ type: 'token', text: t })
      )

      // アシスタント発話を保存
      const saved = await prisma.allinoneChat.create({
        data: {
          analysisId,
          role: 'assistant',
          content: result.text,
          verbose: Boolean(body.verbose),
          modelName: result.model,
        },
      })
      ctrl.send({ type: 'done', messageId: saved.id })
    } catch (err) {
      ctrl.send({
        type: 'error',
        message: err instanceof Error ? err.message : 'chat failed',
      })
    }
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
