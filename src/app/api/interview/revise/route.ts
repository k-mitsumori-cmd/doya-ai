// POST /api/interview/revise - AI修正API
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'

function getGeminiApiKey(): string {
  const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini APIキーが設定されていません')
  return key.trim()
}

export async function POST(req: NextRequest) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null
    if (!userId && !guestId) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
    }

    const body = await req.json()
    const { draftId, articleContent, instruction } = body

    if (!draftId || typeof draftId !== 'string') {
      return NextResponse.json({ success: false, error: 'ドラフトIDが指定されていません' }, { status: 400 })
    }

    // ドラフトの所有者チェック
    const draft = await prisma.interviewDraft.findUnique({
      where: { id: draftId },
      include: { project: { select: { userId: true, guestId: true } } },
    })
    if (!draft) {
      return NextResponse.json({ success: false, error: 'ドラフトが見つかりません' }, { status: 404 })
    }
    const ownerErr = checkOwnership(draft.project, userId, guestId)
    if (ownerErr) return ownerErr
    if (!articleContent || typeof articleContent !== 'string' || articleContent.trim().length < 10) {
      return NextResponse.json({ success: false, error: '修正対象の記事内容が短すぎます' }, { status: 400 })
    }
    if (!instruction || typeof instruction !== 'string' || instruction.trim().length < 2) {
      return NextResponse.json({ success: false, error: '修正指示を入力してください' }, { status: 400 })
    }

    const apiKey = getGeminiApiKey()
    const model = process.env.INTERVIEW_GEMINI_MODEL || process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash'
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const systemPrompt = 'あなたはプロの編集者です。以下の記事に対して、ユーザーの修正指示に従って修正を行ってください。修正した記事全文をMarkdown形式で出力してください。元の記事の構成やトーンはできるだけ維持し、指示された部分のみを修正してください。'
    const userPrompt = systemPrompt + '\n\n====== 修正指示 ======\n' + instruction.trim() + '\n\n====== 修正対象記事 ======\n' + articleContent.slice(0, 60000)

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[interview] revise Gemini API error:', res.status, errText.slice(0, 300))
      throw new Error('AI修正サービスとの通信に失敗しました (' + res.status + ')')
    }

    const geminiData = await res.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('AIから修正結果が返されませんでした')
    }

    let revisedContent = rawText.trim()
    const tb = String.fromCharCode(96, 96, 96)
    if (revisedContent.startsWith(tb + 'markdown')) revisedContent = revisedContent.slice((tb + 'markdown').length)
    else if (revisedContent.startsWith(tb + 'md')) revisedContent = revisedContent.slice((tb + 'md').length)
    else if (revisedContent.startsWith(tb)) revisedContent = revisedContent.slice(3)
    if (revisedContent.endsWith(tb)) revisedContent = revisedContent.slice(0, -3)
    revisedContent = revisedContent.trim()

    return NextResponse.json({
      success: true,
      revisedContent,
      originalLength: articleContent.length,
      revisedLength: revisedContent.length,
    })
  } catch (e: any) {
    console.error('[interview] revise error:', e?.message)
    return NextResponse.json({ success: false, error: e?.message || 'AI修正中にエラーが発生しました' }, { status: 500 })
  }
}
