// ============================================
// POST /api/tenkai/content/analyze
// ============================================
// プロジェクトのテキストをGemini 2.0 Flashで分析

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildAnalysisPrompt } from '@/lib/tenkai/prompts/analysis'

export async function POST(req: NextRequest) {
  let projectId: string | undefined
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    projectId = (body as { projectId: string }).projectId

    if (!projectId) {
      return NextResponse.json({ error: 'projectId は必須です' }, { status: 400 })
    }

    // プロジェクト取得 + 所有者確認
    const project = await prisma.tenkaiProject.findUnique({
      where: { id: projectId },
    })

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    const text = project.inputText || project.transcript
    if (!text) {
      return NextResponse.json(
        { error: 'コンテンツが登録されていません。先にテキストを入力してください。' },
        { status: 400 }
      )
    }

    // ステータスを分析中に更新
    await prisma.tenkaiProject.update({
      where: { id: projectId },
      data: { status: 'analyzing' },
    })

    // Gemini API呼び出し（リトライ付き）
    // 既存サービスと同じフォールバック順でGemini APIキーを取得
    const geminiApiKey =
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY ||
      process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      throw new Error('Gemini APIキーが設定されていません（GOOGLE_AI_API_KEY / GOOGLE_GENAI_API_KEY / GEMINI_API_KEY）')
    }

    const prompt = buildAnalysisPrompt(text, project.title)
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
    const GEMINI_MAX_RETRIES = 2

    let responseText = ''
    let lastGeminiError: Error | null = null
    for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          // exponential backoff: 1s, 3s
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(3, attempt - 1)))
        }

        const geminiRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiApiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
          }),
        })

        if (!geminiRes.ok) {
          const errBody = await geminiRes.text()
          throw new Error(`Gemini API エラー (${geminiRes.status}): ${errBody}`)
        }

        const geminiData = await geminiRes.json()
        responseText =
          geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
        lastGeminiError = null
        break
      } catch (geminiErr: unknown) {
        lastGeminiError = geminiErr instanceof Error ? geminiErr : new Error(String(geminiErr))
        if (attempt < GEMINI_MAX_RETRIES) continue
      }
    }
    if (lastGeminiError) throw lastGeminiError

    // JSON部分を抽出
    let analysis: Record<string, unknown>
    try {
      const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i)
      const jsonStr = jsonMatch ? jsonMatch[1] : responseText
      analysis = JSON.parse(jsonStr.trim())
    } catch {
      const start = responseText.indexOf('{')
      const end = responseText.lastIndexOf('}')
      if (start !== -1 && end !== -1) {
        analysis = JSON.parse(responseText.slice(start, end + 1))
      } else {
        throw new Error('Gemini応答からJSONをパースできませんでした')
      }
    }

    // 分析結果をプロジェクトに保存
    await prisma.tenkaiProject.update({
      where: { id: projectId },
      data: {
        analysis: analysis as any,
        status: 'ready',
      },
    })

    return NextResponse.json({
      projectId,
      analysis,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] analyze error:', message)

    // ステータスを draft に戻す（analyzing のまま放置を防止）
    if (projectId) {
      try {
        await prisma.tenkaiProject.update({
          where: { id: projectId },
          data: { status: 'draft' },
        })
      } catch { /* ignore recovery error */ }
    }

    return NextResponse.json(
      { error: message || 'コンテンツ分析に失敗しました' },
      { status: 500 }
    )
  }
}
