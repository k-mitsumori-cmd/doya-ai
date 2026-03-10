import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'
import { buildFeedbackApplicationPrompt } from '@/lib/interviewx/prompts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  const { userId } = await getInterviewXUser()
  const authErr = requireAuth(userId)
  if (authErr) return authErr

  const project = await prisma.interviewXProject.findUnique({
    where: { id: params.id },
    select: { userId: true, title: true },
  })
  if (!project) return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })

  const ownerErr = checkOwnership(project, userId)
  if (ownerErr) return ownerErr

  // 最新のドラフトを取得
  const latestDraft = await prisma.interviewXDraft.findFirst({
    where: { projectId: params.id },
    orderBy: { version: 'desc' },
  })
  if (!latestDraft) {
    return NextResponse.json({ success: false, error: 'ドラフトがありません' }, { status: 400 })
  }

  // 未適用のフィードバックを取得
  const pendingFeedbacks = await prisma.interviewXFeedback.findMany({
    where: { projectId: params.id, applied: false },
    orderBy: { createdAt: 'asc' },
  })

  if (pendingFeedbacks.length === 0) {
    return NextResponse.json({ success: false, error: '適用するフィードバックがありません' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function sseEvent(data: Record<string, any>): Uint8Array {
        return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
      }

      try {
        controller.enqueue(sseEvent({ type: 'progress', message: `${pendingFeedbacks.length}件のフィードバックを適用中...` }))

        // プロンプト構築
        const prompt = buildFeedbackApplicationPrompt({
          currentContent: latestDraft.content,
          feedbacks: pendingFeedbacks.map(f => ({
            authorType: f.authorType,
            content: f.content,
            section: f.section,
            category: f.category,
          })),
        })

        // Gemini API呼び出し（ストリーミング）
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}&alt=sse`

        controller.enqueue(sseEvent({ type: 'progress', message: 'AIが記事を修正中...' }))

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 16384,
            },
          }),
        })

        if (!geminiRes.ok || !geminiRes.body) {
          throw new Error(`Gemini API error: ${geminiRes.status}`)
        }

        const reader = geminiRes.body.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr || jsonStr === '[DONE]') continue

            try {
              const parsed = JSON.parse(jsonStr)
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || ''
              if (text) {
                fullText += text
                controller.enqueue(sseEvent({ type: 'chunk', text }))
              }
            } catch {
              // skip
            }
          }
        }

        if (!fullText.trim()) throw new Error('AIからの応答が空でした')

        // 新バージョンのドラフトを保存
        const newVersion = latestDraft.version + 1
        const wordCount = fullText.length
        const readingTime = Math.max(1, Math.round(wordCount / 600))

        // タイトルを抽出（最初のH1）
        const titleMatch = fullText.match(/^#\s+(.+)/m)
        const title = titleMatch ? titleMatch[1].trim() : latestDraft.title

        const newDraft = await prisma.interviewXDraft.create({
          data: {
            projectId: params.id,
            version: newVersion,
            title,
            content: fullText,
            wordCount,
            readingTime,
            appliedFeedbacks: pendingFeedbacks.map(f => f.id),
            status: 'REVISED',
          },
        })

        // フィードバックを適用済みに更新
        await prisma.interviewXFeedback.updateMany({
          where: { id: { in: pendingFeedbacks.map(f => f.id) } },
          data: { applied: true, appliedAt: new Date() },
        })

        // プロジェクトステータスを更新
        await prisma.interviewXProject.update({
          where: { id: params.id },
          data: { status: 'REVIEW' },
        })

        controller.enqueue(sseEvent({
          type: 'done',
          draftId: newDraft.id,
          version: newVersion,
          wordCount,
          readingTime,
        }))
      } catch (e: any) {
        console.error('[InterviewX] apply-feedback error:', e)
        controller.enqueue(sseEvent({ type: 'error', message: e.message || 'フィードバック適用に失敗しました' }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
