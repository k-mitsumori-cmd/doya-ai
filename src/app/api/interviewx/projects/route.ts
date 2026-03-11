// ============================================
// GET/POST /api/interviewx/projects
// ============================================
// プロジェクト一覧取得・新規作成
//
// GET: ページネーション対応、ステータスフィルタ、関連カウント付き
// POST: 新規プロジェクト作成（shareToken 自動生成）

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, requireDatabase } from '@/lib/interviewx/access'

// --------------------------------------------------
// GET — プロジェクト一覧
// --------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const dbErr = requireDatabase()
    if (dbErr) return dbErr

    const { userId } = await getInterviewXUser()
    const authErr = requireAuth(userId)
    if (authErr) return authErr

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const status = searchParams.get('status') || undefined
    const skip = (page - 1) * limit

    const where: any = { userId: userId! }
    if (status) {
      where.status = status
    }

    const [projects, total] = await Promise.all([
      prisma.interviewXProject.findMany({
        where,
        include: {
          template: {
            select: { id: true, name: true, category: true, icon: true },
          },
          _count: {
            select: {
              questions: true,
              responses: true,
              drafts: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.interviewXProject.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (e: any) {
    console.error('[interviewx/projects] GET error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'プロジェクト一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

// --------------------------------------------------
// POST — プロジェクト新規作成
// --------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const dbErr = requireDatabase()
    if (dbErr) return dbErr

    const { userId } = await getInterviewXUser()
    const authErr = requireAuth(userId)
    if (authErr) return authErr

    const body = await req.json()
    const {
      title,
      templateId,
      companyName,
      companyUrl,
      companyLogo,
      brandColor,
      purpose,
      targetAudience,
      tone,
      articleType,
      wordCountTarget,
      customInstructions,
      respondentName,
      respondentEmail,
      interviewMode,
      hearingType,
    } = body as {
      title: string
      templateId: string
      companyName?: string
      companyUrl?: string
      companyLogo?: string
      brandColor?: string
      purpose?: string
      targetAudience?: string
      tone?: string
      articleType?: string
      hearingType?: string
      wordCountTarget?: number
      customInstructions?: string
      respondentName?: string
      respondentEmail?: string
      interviewMode?: string
    }

    if (!title || !templateId) {
      return NextResponse.json(
        { success: false, error: 'title と templateId は必須です' },
        { status: 400 }
      )
    }

    // テンプレートの存在確認
    const template = await prisma.interviewXTemplate.findUnique({
      where: { id: templateId },
    })
    if (!template) {
      return NextResponse.json(
        { success: false, error: 'テンプレートが見つかりません' },
        { status: 404 }
      )
    }

    const project = await prisma.interviewXProject.create({
      data: {
        userId: userId!,
        title,
        templateId,
        companyName: companyName || null,
        companyUrl: companyUrl || null,
        companyLogo: companyLogo || null,
        brandColor: brandColor || '#3B82F6',
        purpose: purpose || null,
        targetAudience: targetAudience || null,
        tone: tone || 'professional',
        articleType: articleType || hearingType || 'BUSINESS_MEETING',
        hearingType: hearingType || articleType || 'BUSINESS_MEETING',
        wordCountTarget: wordCountTarget || 3000,
        customInstructions: customInstructions || null,
        respondentName: respondentName || null,
        respondentEmail: respondentEmail || null,
        interviewMode: 'chat',
        status: 'DRAFT',
      },
      include: {
        template: {
          select: { id: true, name: true, category: true, icon: true },
        },
      },
    })

    return NextResponse.json({ success: true, project }, { status: 201 })
  } catch (e: any) {
    console.error('[interviewx/projects] POST error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'プロジェクト作成に失敗しました' },
      { status: 500 }
    )
  }
}
