import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'
import { buildQualityCheckPrompt } from '@/lib/interviewx/prompts'
import type { CheckType } from '@/lib/interviewx/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const VALID_CHECK_TYPES: CheckType[] = ['PROOFREAD', 'FACT_CHECK', 'READABILITY', 'BRAND_CONSISTENCY', 'SENSITIVITY']

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; draftId: string } }
) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  const { userId } = await getInterviewXUser()
  const authErr = requireAuth(userId)
  if (authErr) return authErr

  try {
    const project = await prisma.interviewXProject.findUnique({
      where: { id: params.id },
      select: {
        userId: true,
        companyName: true,
        brandColor: true,
        questions: { select: { text: true, order: true } },
        responses: {
          where: { status: 'COMPLETED' },
          take: 1,
          include: {
            answers: { include: { question: { select: { text: true } } } },
          },
        },
      },
    })
    if (!project) return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })

    const ownerErr = checkOwnership(project, userId)
    if (ownerErr) return ownerErr

    const draft = await prisma.interviewXDraft.findUnique({
      where: { id: params.draftId },
    })
    if (!draft || draft.projectId !== params.id) {
      return NextResponse.json({ success: false, error: 'ドラフトが見つかりません' }, { status: 404 })
    }

    const body = await req.json()
    const checkType = body.checkType as CheckType

    if (!checkType || !VALID_CHECK_TYPES.includes(checkType)) {
      return NextResponse.json({
        success: false,
        error: `checkTypeは ${VALID_CHECK_TYPES.join(', ')} のいずれかを指定してください`,
      }, { status: 400 })
    }

    // Q&Aコンテキストの構築
    const response = project.responses[0]
    const questionsAndAnswers = response
      ? response.answers
          .map(a => ({
            question: a.question?.text || '',
            answer: a.answerText || '',
          }))
          .filter(qa => qa.question && qa.answer)
      : undefined

    // プロンプト構築
    const prompt = buildQualityCheckPrompt(checkType, draft.content, {
      questionsAndAnswers,
      companyName: project.companyName,
      brandColor: project.brandColor,
    })

    // Gemini API呼び出し
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'AI APIキーが設定されていません' }, { status: 500 })
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('[InterviewX] Gemini check error:', errText)
      return NextResponse.json({ success: false, error: 'AI品質チェックに失敗しました' }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

    let checkResult: any
    try {
      checkResult = JSON.parse(responseText)
    } catch {
      // JSON抽出を試みる
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        checkResult = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('AIからのレスポンスをパースできませんでした')
      }
    }

    // DBに保存
    const check = await prisma.interviewXCheck.create({
      data: {
        projectId: params.id,
        draftId: params.draftId,
        checkType,
        score: checkResult.score ?? null,
        passed: checkResult.passed ?? false,
        report: checkResult.summary || null,
        suggestions: checkResult.suggestions || [],
      },
    })

    // プロジェクトステータスをFINALIZINGに更新（全チェック合格時）
    const allChecks = await prisma.interviewXCheck.findMany({
      where: { draftId: params.draftId },
    })
    const allPassed = VALID_CHECK_TYPES.every(type =>
      allChecks.some(c => c.checkType === type && c.passed)
    )
    if (allPassed) {
      await prisma.interviewXProject.update({
        where: { id: params.id },
        data: { status: 'FINALIZING' },
      })
    }

    return NextResponse.json({ success: true, check })
  } catch (e: any) {
    console.error('[InterviewX] check error:', e)
    return NextResponse.json({ success: false, error: e.message || '品質チェックに失敗しました' }, { status: 500 })
  }
}
