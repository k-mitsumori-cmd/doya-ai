import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * ジョブ状態を取得（ポーリング用）
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }
    
    const userId = (session.user as any).id
    
    const job = await prisma.generationJob.findFirst({
      where: {
        id: params.jobId,
        userId, // 本人のジョブのみ
      },
      include: {
        assets: {
          orderBy: { variant: 'asc' },
        },
        template: {
          select: { name: true },
        },
      },
    })
    
    if (!job) {
      return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 })
    }
    
    return NextResponse.json({
      id: job.id,
      status: job.status,
      size: job.size,
      inputData: job.inputData,
      assets: job.assets.map(asset => ({
        id: asset.id,
        variant: asset.variant,
        url: asset.url,
      })),
      templateName: job.template?.name,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    })
  } catch (error) {
    console.error('Get job error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

