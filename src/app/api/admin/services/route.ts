export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })

    const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try { return await fn() } catch { return fallback }
    }

    const [
      totalUsers, proUsers,
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
      safe(() => prisma.user.count(), 0),
      safe(() => prisma.user.count({ where: { plan: { in: ['PRO', 'LIGHT', 'ENTERPRISE', 'BUNDLE', 'STARTER'] } } }), 0),
      safe(() => prisma.seoArticle.count(), 0),
      safe(() => prisma.seoJob.count(), 0),
      safe(() => prisma.generation.count({ where: { service: 'banner' } }), 0),
      safe(() => prisma.interviewProject.count(), 0),
      safe(() => prisma.interviewTranscription.count(), 0),
      safe(() => prisma.copyProject.count(), 0),
      safe(() => prisma.copyItem.count(), 0),
      safe(() => prisma.lpProject.count(), 0),
      safe(() => prisma.voiceProject.count(), 0),
      safe(() => prisma.movieProject.count(), 0),
      safe(() => prisma.kintaiOrganization.count(), 0),
      safe(() => prisma.kintaiEmployee.count(), 0),
      safe(() => prisma.kintaiClockRecord.count(), 0),
      safe(() => prisma.hrOrganization.count(), 0),
      safe(() => prisma.hrEmployee.count(), 0),
      safe(() => prisma.tenkaiProject.count(), 0),
      safe(() => prisma.adSimProject.count(), 0),
    ])

    const services = [
      { id: 'seo', name: 'ドヤライティングAI', icon: '✍️', path: '/seo', status: 'active', stats: { articles: seoArticles, jobs: seoJobs }, color: 'emerald' },
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
      freeUsers: totalUsers - proUsers,
      services,
    })
  } catch (e) {
    console.error('[admin/services]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
