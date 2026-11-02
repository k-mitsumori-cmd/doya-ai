import { cookies } from 'next/headers'
import { COOKIE_NAME, verifyAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { privateApiJson } from '@/lib/private-api-response'
import { jstDateKey, jstDayRange } from '@/lib/jst'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const token = (await cookies()).get(COOKIE_NAME)?.value
    if (!(await verifyAdminSession(token || null)).valid) {
      return privateApiJson({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const now = new Date()
    const { start, end } = jstDayRange(now)
    const createdAt = { gte: start, lt: end }
    // Generation includes USAGE rows and generated content. This counts records,
    // not generated outputs, anonymous uses, or metadata.count units.
    const [recordedActivities, newUsers] = await Promise.all([
      prisma.generation.count({ where: { createdAt } }),
      prisma.user.count({ where: { createdAt } }),
    ])

    return privateApiJson({
      date: jstDateKey(now),
      timeZone: 'Asia/Tokyo',
      recordedActivities,
      newUsers,
      updatedAt: now.toISOString(),
    })
  } catch {
    return privateApiJson({ error: '本日の統計を取得できませんでした' }, { status: 503 })
  }
}
