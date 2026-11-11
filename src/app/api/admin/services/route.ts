export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { summarizeRegisteredPlans } from '@/lib/admin-registered-plan-stats'
import { getRunningServices } from '@/lib/services'

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401, headers: privateHeaders })

    const [
      planRows,
      seoArticles, seoJobs,
      bannerGenerations,
      interviewProjects, interviewTranscriptions,
      kintaiOrgs, kintaiEmployees, kintaiClockRecords,
      hrOrgs, hrEmployees,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
      prisma.seoArticle.count(),
      prisma.seoJob.count(),
      prisma.generation.count({ where: { serviceId: 'banner' } }),
      prisma.interviewProject.count(),
      prisma.interviewTranscription.count(),
      prisma.kintaiOrganization.count(),
      prisma.kintaiEmployee.count(),
      prisma.kintaiClockRecord.count(),
      prisma.hrOrganization.count(),
      prisma.hrEmployee.count(),
    ])

    const { totalUsers, paidPlanUsers: proUsers, otherPlanUsers: freeUsers } = summarizeRegisteredPlans(planRows)

    const countsByService = new Map<string, Record<string, number>>([
      ['seo', { articles: seoArticles, jobs: seoJobs }],
      ['banner', { generations: bannerGenerations }],
      ['interview', { projects: interviewProjects, transcriptions: interviewTranscriptions }],
      ['kintai', { organizations: kintaiOrgs, employees: kintaiEmployees, clockRecords: kintaiClockRecords }],
      ['hr', { organizations: hrOrgs, employees: hrEmployees }],
    ])
    // 管理者には集計未実装・限定公開のサービスも表示する。
    const services = getRunningServices().map(service => ({
      id: service.id,
      name: service.name,
      icon: service.icon,
      path: service.href,
      status: service.status,
      limited: service.hidden === 'beta',
      stats: countsByService.get(service.id) ?? {},
      color: service.color,
    }))

    return NextResponse.json({
      totalUsers,
      proUsers,
      freeUsers,
      services,
    }, { headers: privateHeaders })
  } catch {
    console.error('[admin/services]')
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500, headers: privateHeaders })
  }
}
