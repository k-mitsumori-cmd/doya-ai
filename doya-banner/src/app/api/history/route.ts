import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * 生成履歴を取得
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }
    
    const userId = (session.user as any).id
    
    // クエリパラメータ
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') // 'completed' | 'failed' | null
    
    const skip = (page - 1) * limit
    
    // 条件構築
    const where = {
      userId,
      ...(status && { status }),
    }
    
    // 総数とジョブ一覧を取得
    const [total, jobs] = await Promise.all([
      prisma.generationJob.count({ where }),
      prisma.generationJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          assets: {
            orderBy: { variant: 'asc' },
            select: {
              id: true,
              variant: true,
              url: true,
            },
          },
          template: {
            select: {
              name: true,
            },
          },
        },
      }),
    ])
    
    return NextResponse.json({
      jobs: jobs.map(job => ({
        id: job.id,
        status: job.status,
        size: job.size,
        inputData: job.inputData,
        templateName: job.template?.name,
        assets: job.assets,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get history error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

