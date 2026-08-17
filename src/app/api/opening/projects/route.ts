import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SERVICE_RETIRED, retiredServiceResponse } from '@/lib/retired-service'

export async function GET(req: NextRequest) {
  // ⚠️ 提供終了。入口だけ閉じる（本体とデータは復旧の余地のため残す）
  if (SERVICE_RETIRED) return retiredServiceResponse('ドヤオープニングAI')

  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id

    if (!userId) {
      return NextResponse.json({ projects: [] })
    }

    const projects = await prisma.openingProject.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { animations: true } },
      },
    })

    return NextResponse.json({ projects })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
