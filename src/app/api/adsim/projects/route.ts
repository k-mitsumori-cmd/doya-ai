// ============================================
// GET/POST /api/adsim/projects
// ============================================
// ドヤ広告シミュレーションAI プロジェクト一覧・作成

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - プロジェクト一覧取得
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    if (!userId) {
      return NextResponse.json({ projects: [] })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = parseInt(searchParams.get('offset') || '0')

    const [projects, total] = await Promise.all([
      prisma.adSimProject.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.adSimProject.count({ where: { userId } }),
    ])

    return NextResponse.json({ projects, total })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[adsim] projects GET error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// プラン → 月間上限プロジェクト数（API コスト管理のため Pro も制限あり）
// 他のドヤサービスと同様に月間ベース管理
function getAdSimMonthlyLimit(plan: string | null | undefined): number {
  if (process.env.DOYA_DISABLE_LIMITS === '1' || process.env.ADSIM_DISABLE_LIMITS === '1') return -1
  const p = String(plan || 'FREE').toUpperCase()
  if (p === 'ENTERPRISE') return 500
  if (p === 'PRO' || p === 'BASIC' || p === 'STARTER' || p === 'BUSINESS' || p === 'BUNDLE') return 100
  if (p === 'LIGHT') return 15
  return 3 // FREE
}

// POST - プロジェクト作成（要ログイン + 月次使用制限）
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    // 月次使用制限チェック
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    })
    const limit = getAdSimMonthlyLimit(user?.plan)
    if (limit !== -1) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const monthCount = await prisma.adSimProject.count({
        where: { userId, createdAt: { gte: startOfMonth } },
      })
      if (monthCount >= limit) {
        return NextResponse.json(
          {
            error: `今月の作成上限（${limit}件）に達しました。Pro プランで無制限になります。初月無料でお試しいただけます。`,
            code: 'MONTHLY_LIMIT_REACHED',
            limit,
            current: monthCount,
          },
          { status: 402 }
        )
      }
    }

    const body = await req.json()
    const {
      name,
      clientName,
      industry,
      productName,
      lpUrl,
      targetAudience,
      goals,
      periodMonths,
      startMonth,
      monthlyBudget,
      targetCv,
      targetCpa,
      targetRoas,
      mediaAllocation,
      proposerName,
      proposerEmail,
      templateId,
    } = body

    if (!clientName || !industry || !productName || !monthlyBudget || !mediaAllocation) {
      return NextResponse.json(
        { error: 'clientName, industry, productName, monthlyBudget, mediaAllocation は必須です' },
        { status: 400 }
      )
    }

    const project = await prisma.adSimProject.create({
      data: {
        userId,
        name: name || `${clientName} 広告提案`,
        clientName,
        industry,
        productName,
        lpUrl: lpUrl || null,
        targetAudience: targetAudience || null,
        goals: goals || [],
        periodMonths: periodMonths || 3,
        startMonth: startMonth || null,
        monthlyBudget: Number(monthlyBudget),
        targetCv: targetCv ? Number(targetCv) : null,
        targetCpa: targetCpa ? Number(targetCpa) : null,
        targetRoas: targetRoas ? Number(targetRoas) : null,
        mediaAllocation,
        proposerName: proposerName || null,
        proposerEmail: proposerEmail || null,
        templateId: templateId || 'simple',
        status: 'draft',
      },
    })

    return NextResponse.json({ project })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[adsim] projects POST error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
