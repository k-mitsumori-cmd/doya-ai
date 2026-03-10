// ============================================
// POST /api/interviewx/public/[token]/respond
// ============================================
// 公開アンケート回答送信（認証不要）
// InterviewXResponse + InterviewXAnswer を作成し、
// プロジェクトステータスを ANSWERED に更新

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface AnswerInput {
  questionId: string
  answerText?: string
  answerValue?: any
}

interface RespondBody {
  respondentName?: string
  respondentEmail?: string
  respondentRole?: string
  respondentCompany?: string
  answers: AnswerInput[]
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    if (!token) {
      return NextResponse.json(
        { success: false, error: '無効なリンクです' },
        { status: 400 }
      )
    }

    // プロジェクト取得
    const project = await prisma.interviewXProject.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        status: true,
        questions: {
          select: { id: true, required: true, type: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'アンケートが見つかりません' },
        { status: 404 }
      )
    }

    if (!['SHARED', 'RESPONDING'].includes(project.status)) {
      return NextResponse.json(
        { success: false, error: 'このアンケートは現在回答を受け付けていません' },
        { status: 410 }
      )
    }

    const body: RespondBody = await req.json()
    const { respondentName, respondentEmail, respondentRole, respondentCompany, answers } = body

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { success: false, error: '回答が空です' },
        { status: 400 }
      )
    }

    // 必須チェック
    const questionMap = new Map(project.questions.map((q) => [q.id, q]))
    for (const q of project.questions) {
      if (q.required) {
        const answer = answers.find((a) => a.questionId === q.id)
        if (!answer) {
          return NextResponse.json(
            { success: false, error: '必須の質問に未回答があります' },
            { status: 400 }
          )
        }
        // TEXT / TEXTAREA は answerText 必須
        if (['TEXT', 'TEXTAREA'].includes(q.type)) {
          if (!answer.answerText?.trim()) {
            return NextResponse.json(
              { success: false, error: '必須の質問に未回答があります' },
              { status: 400 }
            )
          }
        }
        // SELECT / RATING / YES_NO は answerValue or answerText 必須
        if (['SELECT', 'RATING', 'YES_NO'].includes(q.type)) {
          if (answer.answerValue === undefined && !answer.answerText?.trim()) {
            return NextResponse.json(
              { success: false, error: '必須の質問に未回答があります' },
              { status: 400 }
            )
          }
        }
      }
    }

    // IPアドレスとUserAgent取得
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
    const userAgent = req.headers.get('user-agent') || null

    // トランザクションで Response + Answers 作成 + Project 更新
    const result = await prisma.$transaction(async (tx) => {
      // InterviewXResponse 作成
      const response = await tx.interviewXResponse.create({
        data: {
          projectId: project.id,
          respondentName: respondentName || null,
          respondentEmail: respondentEmail || null,
          respondentRole: respondentRole || null,
          respondentCompany: respondentCompany || null,
          status: 'COMPLETED',
          completedAt: new Date(),
          ipAddress,
          userAgent,
        },
      })

      // InterviewXAnswer を一括作成
      const validAnswers = answers.filter((a) => questionMap.has(a.questionId))
      if (validAnswers.length > 0) {
        await tx.interviewXAnswer.createMany({
          data: validAnswers.map((a) => ({
            responseId: response.id,
            questionId: a.questionId,
            answerText: a.answerText || null,
            answerValue: a.answerValue !== undefined ? a.answerValue : null,
          })),
        })
      }

      // プロジェクトステータスを ANSWERED に更新 + 回答者情報の保存
      await tx.interviewXProject.update({
        where: { id: project.id },
        data: {
          status: 'ANSWERED',
          ...(respondentName ? { respondentName } : {}),
          ...(respondentEmail ? { respondentEmail } : {}),
        },
      })

      return response
    })

    return NextResponse.json({
      success: true,
      responseId: result.id,
    })
  } catch (e: any) {
    console.error('[interviewx] respond POST error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
