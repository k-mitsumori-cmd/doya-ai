export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { summarizeRegisteredPlans } from '@/lib/admin-registered-plan-stats'

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
      copyProjects, copyItems,
      lpProjects,
      voiceProjects,
      movieProjects,
      kintaiOrgs, kintaiEmployees, kintaiClockRecords,
      hrOrgs, hrEmployees,
      tenkaiProjects,
      adSimProjects,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
      prisma.seoArticle.count(),
      prisma.seoJob.count(),
      prisma.generation.count({ where: { serviceId: 'banner' } }),
      prisma.interviewProject.count(),
      prisma.interviewTranscription.count(),
      prisma.copyProject.count(),
      prisma.copyItem.count(),
      prisma.lpProject.count(),
      prisma.voiceProject.count(),
      prisma.movieProject.count(),
      prisma.kintaiOrganization.count(),
      prisma.kintaiEmployee.count(),
      prisma.kintaiClockRecord.count(),
      prisma.hrOrganization.count(),
      prisma.hrEmployee.count(),
      prisma.tenkaiProject.count(),
      prisma.adSimProject.count(),
    ])

    const { totalUsers, paidPlanUsers: proUsers, otherPlanUsers: freeUsers } = summarizeRegisteredPlans(planRows)

    const services = [
      { id: 'seo', name: 'ドヤ記事作成', icon: '✍️', path: '/seo', status: 'active', stats: { articles: seoArticles, jobs: seoJobs }, color: 'emerald' },
      { id: 'banner', name: 'ドヤバナーAI', icon: '🎨', path: '/banner', status: 'active', stats: { generations: bannerGenerations }, color: 'violet' },
      { id: 'interview', name: 'ドヤインタビュー', icon: '🎙️', path: '/interview', status: 'active', stats: { projects: interviewProjects, transcriptions: interviewTranscriptions }, color: 'rose' },
      { id: 'copy', name: 'ドヤコピーAI', icon: '📝', path: '/copy', status: 'active', stats: { projects: copyProjects, items: copyItems }, color: 'amber' },
      { id: 'lp', name: 'ドヤLP AI', icon: '📄', path: '/lp', status: 'active', stats: { projects: lpProjects }, color: 'cyan' },
      { id: 'voice', name: 'ドヤボイスAI', icon: '🔊', path: '/voice', status: 'active', stats: { projects: voiceProjects }, color: 'indigo' },
      { id: 'movie', name: 'ドヤ動画AI', icon: '🎬', path: '/movie', status: 'active', stats: { projects: movieProjects }, color: 'pink' },
      { id: 'kintai', name: 'ドヤ勤怠', icon: '⏰', path: '/kintai', status: 'active', stats: { organizations: kintaiOrgs, employees: kintaiEmployees, clockRecords: kintaiClockRecords }, color: 'purple' },
      { id: 'hr', name: 'ドヤHR', icon: '💼', path: '/hr', status: 'active', stats: { organizations: hrOrgs, employees: hrEmployees }, color: 'blue' },
      { id: 'tenkai', name: 'ドヤ展開AI', icon: '🔄', path: '/tenkai', status: 'coming_soon', stats: { projects: tenkaiProjects }, color: 'teal' },
      { id: 'adsim', name: 'ドヤ広告シミュレーション', icon: '📊', path: '/adsim', status: 'coming_soon', stats: { projects: adSimProjects }, color: 'orange' },
    ]

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
