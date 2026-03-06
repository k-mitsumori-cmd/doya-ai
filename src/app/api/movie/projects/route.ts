import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkMovieUsage, getGuestIdFromRequest, MOVIE_GUEST_COOKIE } from '@/lib/movie/access'
import { getTemplateById } from '@/lib/movie/templates'
import { v4 as uuidv4 } from 'uuid'

// ---- プラン判定ヘルパー ----

function isProPlan(plan: string | null | undefined): boolean {
  const p = String(plan || 'FREE').toUpperCase()
  return ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)
}

// GET /api/movie/projects - プロジェクト一覧
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const guestId = getGuestIdFromRequest(req)

    if (!session?.user?.email && !guestId) {
      return NextResponse.json({ projects: [] })
    }

    let userId: string | null = null
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      userId = user?.id ?? null
    }

    const where = userId
      ? { userId }
      : { guestId }

    const limitParam = req.nextUrl.searchParams.get('limit')
    const take = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50

    const projects = await prisma.movieProject.findMany({
      where,
      include: {
        scenes: { orderBy: { order: 'asc' } },
        renderJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take,
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('[GET /api/movie/projects]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

// POST /api/movie/projects - プロジェクト作成
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const guestId = getGuestIdFromRequest(req) ?? uuidv4()

    let userId: string | null = null
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      userId = user?.id ?? null
    }

    const usage = await checkMovieUsage(userId, guestId)
    if (!usage.canGenerate) {
      return NextResponse.json({ error: usage.reason ?? '利用上限に達しました' }, { status: 429 })
    }

    const body = await req.json()
    const { name, aspectRatio, duration, resolution, platform, templateId, productInfo, persona, plans, selectedPlan, status } = body

    // テンプレートのProフラグ検証
    if (templateId) {
      const template = getTemplateById(templateId)
      if (template?.isPro) {
        // ユーザーのプランを取得して検証
        let currentPlan = 'FREE'
        if (userId) {
          const subscription = await prisma.userServiceSubscription.findUnique({
            where: { userId_serviceId: { userId, serviceId: 'movie' } },
          })
          currentPlan = subscription?.plan ?? 'FREE'
        }
        if (!isProPlan(currentPlan)) {
          return NextResponse.json(
            {
              error: 'このテンプレートはProプラン以上で利用可能です。プランをアップグレードしてください。',
              code: 'TEMPLATE_PRO_ONLY',
              templateId,
              upgradePath: '/movie/pricing',
            },
            { status: 403 }
          )
        }
      }
    }

    const commonData = {
      name: name ?? '新規プロジェクト',
      aspectRatio: aspectRatio ?? '16:9',
      duration: duration ?? 15,
      platform,
      templateId,
      ...(productInfo && { productInfo }),
      ...(persona && { persona }),
      ...(plans && { plans }),
      ...(selectedPlan !== undefined && { selectedPlan }),
      ...(status && { status }),
    }

    if (!userId) {
      // ゲストはuserIdなしで作成
      const project = await prisma.movieProject.create({
        data: {
          guestId,
          resolution: resolution ?? '720p',
          ...commonData,
        },
      })
      const res = NextResponse.json({ project, guestId })
      res.cookies.set(MOVIE_GUEST_COOKIE, guestId, { maxAge: 60 * 60 * 24 * 30 })
      return res
    }

    const project = await prisma.movieProject.create({
      data: {
        userId,
        resolution: resolution ?? '1080p',
        ...commonData,
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('[POST /api/movie/projects]', error)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
