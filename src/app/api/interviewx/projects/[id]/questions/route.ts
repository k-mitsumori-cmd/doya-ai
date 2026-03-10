// ============================================
// PUT /api/interviewx/projects/[id]/questions
// ============================================
// 質問の一括更新
//
// リクエスト: { questions: [{ id?, text, type, required, order, description, options }] }
// - idがあれば更新、なければ新規作成
// - 送信されなかった既存質問は削除

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'

type RouteParams = { params: Promise<{ id: string }> }

// --------------------------------------------------
// PUT — 質問一括更新
// --------------------------------------------------
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const dbErr = requireDatabase()
    if (dbErr) return dbErr

    const { userId } = await getInterviewXUser()
    const authErr = requireAuth(userId)
    if (authErr) return authErr

    const { id } = await params

    const project = await prisma.interviewXProject.findUnique({
      where: { id },
    })
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'プロジェクトが見つかりません' },
        { status: 404 }
      )
    }

    const ownerErr = checkOwnership(project, userId)
    if (ownerErr) return ownerErr

    const body = await req.json()
    const { questions } = body as {
      questions: Array<{
        id?: string
        text: string
        type?: string
        required?: boolean
        order: number
        description?: string
        options?: any
      }>
    }

    if (!Array.isArray(questions)) {
      return NextResponse.json(
        { success: false, error: 'questions は配列で指定してください' },
        { status: 400 }
      )
    }

    // 送信された質問のIDリスト（更新対象）
    const incomingIds = questions.filter((q) => q.id).map((q) => q.id!)

    // 送信リストに含まれない既存質問を削除
    await prisma.interviewXQuestion.deleteMany({
      where: {
        projectId: id,
        ...(incomingIds.length > 0
          ? { id: { notIn: incomingIds } }
          : {}),
      },
    })

    // 更新 or 新規作成
    const updatedQuestions = await Promise.all(
      questions.map(async (q) => {
        if (q.id) {
          // 既存質問を更新
          return prisma.interviewXQuestion.update({
            where: { id: q.id },
            data: {
              text: q.text,
              type: q.type || 'TEXTAREA',
              required: q.required !== false,
              order: q.order,
              description: q.description || null,
              options: q.options || null,
            },
          })
        } else {
          // 新規質問を作成
          return prisma.interviewXQuestion.create({
            data: {
              projectId: id,
              text: q.text,
              type: q.type || 'TEXTAREA',
              required: q.required !== false,
              order: q.order,
              description: q.description || null,
              options: q.options || null,
              aiGenerated: false,
            },
          })
        }
      })
    )

    // order順でソートして返す
    updatedQuestions.sort((a, b) => a.order - b.order)

    return NextResponse.json({ success: true, questions: updatedQuestions })
  } catch (e: any) {
    console.error('[interviewx/questions] PUT error:', e?.message)
    return NextResponse.json(
      { success: false, error: '質問の更新に失敗しました' },
      { status: 500 }
    )
  }
}
