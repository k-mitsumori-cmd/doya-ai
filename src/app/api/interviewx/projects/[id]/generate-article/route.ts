// ============================================
// POST /api/interviewx/projects/[id]/generate-article
// ============================================
// 回答データから記事を自動生成 — SSE (Server-Sent Events) ストリーミング
// Gemini API でアンケート回答をベースにインタビュー記事を生成
//
// レスポンス: SSE stream (data: JSON\n\n)
//   - { type: 'progress', message: string }
//   - { type: 'chunk', text: string }
//   - { type: 'done', draftId, version, wordCount, readingTime }
//   - { type: 'error', message: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'
import { buildArticleGenerationPrompt } from '@/lib/interviewx/prompts'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  const encoder = new TextEncoder()

  function sseEvent(data: Record<string, any>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ====== 認証 ======
        const { userId } = await getInterviewXUser()
        const authErrRes = requireAuth(userId)
        if (authErrRes) {
          controller.enqueue(sseEvent({ type: 'error', message: 'ログインが必要です' }))
          controller.close()
          return
        }

        const { id } = await params

        controller.enqueue(sseEvent({ type: 'progress', message: 'プロジェクト情報を読み込み中...' }))

        // ====== プロジェクト・質問・回答を取得 ======
        const project = await prisma.interviewXProject.findUnique({
          where: { id },
          include: {
            template: true,
            questions: { orderBy: { order: 'asc' } },
            responses: {
              where: { status: 'COMPLETED' },
              include: { answers: true },
              orderBy: { completedAt: 'desc' },
              take: 1,
            },
          },
        })

        if (!project) {
          controller.enqueue(sseEvent({ type: 'error', message: 'プロジェクトが見つかりません' }))
          controller.close()
          return
        }

        const ownerErr = checkOwnership(project, userId)
        if (ownerErr) {
          controller.enqueue(sseEvent({ type: 'error', message: '権限がありません' }))
          controller.close()
          return
        }

        const response = project.responses[0]
        if (!response) {
          controller.enqueue(sseEvent({ type: 'error', message: '回答が見つかりません。回答者がアンケートに回答してから実行してください。' }))
          controller.close()
          return
        }

        controller.enqueue(sseEvent({ type: 'progress', message: '回答データを整理中...' }))

        // Q&Aペアを構築
        const questionsAndAnswers = project.questions.map(q => {
          const answer = response.answers.find(a => a.questionId === q.id)
          return {
            question: q.text,
            answer: answer?.answerText || (answer?.answerValue ? JSON.stringify(answer.answerValue) : '（未回答）'),
          }
        }).filter(qa => qa.answer !== '（未回答）')

        if (questionsAndAnswers.length === 0) {
          controller.enqueue(sseEvent({ type: 'error', message: '有効な回答がありません' }))
          controller.close()
          return
        }

        controller.enqueue(sseEvent({ type: 'progress', message: 'AIで記事を生成中...' }))

        // ====== プロンプト構築 ======
        const prompt = buildArticleGenerationPrompt({
          templateName: project.template?.name || '一般',
          templatePrompt: project.template?.promptTemplate as string | null,
          projectTitle: project.title,
          companyName: project.companyName,
          respondentName: response.respondentName || project.respondentName,
          respondentRole: response.respondentRole,
          respondentCompany: response.respondentCompany,
          purpose: project.purpose,
          targetAudience: project.targetAudience,
          tone: project.tone as any,
          articleType: project.articleType as any,
          wordCountTarget: project.wordCountTarget,
          customInstructions: project.customInstructions,
          questionsAndAnswers,
        })

        // ====== Gemini API ストリーミング呼び出し ======
        const apiKey =
          process.env.GOOGLE_GENAI_API_KEY ||
          process.env.GOOGLE_AI_API_KEY ||
          process.env.GEMINI_API_KEY
        if (!apiKey) throw new Error('Gemini APIキーが設定されていません')

        const model = 'gemini-2.0-flash'
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey.trim()}&alt=sse`

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 16384,
            },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
            ],
          }),
        })

        if (!geminiRes.ok || !geminiRes.body) {
          const errText = await geminiRes.text().catch(() => '')
          console.error('[interviewx] Gemini API error:', geminiRes.status, errText)
          throw new Error(`AI API エラー (${geminiRes.status})`)
        }

        // ====== SSEストリーム読み取り ======
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

        controller.enqueue(sseEvent({ type: 'progress', message: '記事を保存中...' }))

        // ====== ドラフト保存 ======
        // 既存ドラフトの最新バージョン取得
        const existingDraft = await prisma.interviewXDraft.findFirst({
          where: { projectId: id },
          orderBy: { version: 'desc' },
          select: { version: true },
        })
        const newVersion = (existingDraft?.version || 0) + 1

        const wordCount = fullText.length
        const readingTime = Math.max(1, Math.round(wordCount / 600))

        // タイトルを抽出（最初のH1）
        const titleMatch = fullText.match(/^#\s+(.+)/m)
        const title = titleMatch ? titleMatch[1].trim() : project.title

        // リード文を抽出（H1の次の段落）
        const leadMatch = fullText.match(/^#\s+.+\n\n(.+?)(?:\n\n|$)/m)
        const lead = leadMatch ? leadMatch[1].trim() : null

        const newDraft = await prisma.interviewXDraft.create({
          data: {
            projectId: id,
            version: newVersion,
            title,
            lead,
            content: fullText,
            wordCount,
            readingTime,
            status: 'DRAFT',
          },
        })

        // プロジェクトステータスを更新
        await prisma.interviewXProject.update({
          where: { id },
          data: { status: 'REVIEW' },
        })

        controller.enqueue(sseEvent({
          type: 'done',
          message: `記事を生成しました（${wordCount}文字）`,
          draftId: newDraft.id,
          version: newVersion,
          wordCount,
          readingTime,
        }))

        controller.close()
      } catch (e: any) {
        console.error('[interviewx] generate-article error:', e?.message)
        try {
          controller.enqueue(sseEvent({ type: 'error', message: e?.message || '記事生成に失敗しました' }))
        } catch {
          // controller already closed
        }
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
