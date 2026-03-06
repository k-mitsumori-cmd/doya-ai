import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { BgmTrack } from '@/lib/movie/types'

// ---- プラン判定ヘルパー ----

function isProPlan(plan: string | null | undefined): boolean {
  const p = String(plan || 'FREE').toUpperCase()
  return ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)
}

// フリーBGMライブラリ（サンプル。本番はSupabase Storageに配置）
const BGM_TRACKS: BgmTrack[] = [
  { id: 'corporate-1', name: 'Corporate Drive', genre: 'corporate', duration: 60, url: '/audio/bgm/corporate-drive.mp3', isPro: false },
  { id: 'corporate-2', name: 'Business Bright', genre: 'corporate', duration: 60, url: '/audio/bgm/business-bright.mp3', isPro: false },
  { id: 'energetic-1', name: 'Energy Boost', genre: 'energetic', duration: 60, url: '/audio/bgm/energy-boost.mp3', isPro: false },
  { id: 'energetic-2', name: 'Power Forward', genre: 'energetic', duration: 60, url: '/audio/bgm/power-forward.mp3', isPro: true },
  { id: 'emotional-1', name: 'Heartfelt Story', genre: 'emotional', duration: 60, url: '/audio/bgm/heartfelt-story.mp3', isPro: false },
  { id: 'emotional-2', name: 'Touching Moment', genre: 'emotional', duration: 60, url: '/audio/bgm/touching-moment.mp3', isPro: true },
  { id: 'minimal-1', name: 'Clean Minimal', genre: 'minimal', duration: 60, url: '/audio/bgm/clean-minimal.mp3', isPro: false },
  { id: 'minimal-2', name: 'Simple Flow', genre: 'minimal', duration: 60, url: '/audio/bgm/simple-flow.mp3', isPro: true },
  { id: 'fun-1', name: 'Playful Pop', genre: 'fun', duration: 60, url: '/audio/bgm/playful-pop.mp3', isPro: false },
  { id: 'fun-2', name: 'Happy Vibes', genre: 'fun', duration: 60, url: '/audio/bgm/happy-vibes.mp3', isPro: true },
  { id: 'luxury-1', name: 'Luxury Brand', genre: 'luxury', duration: 60, url: '/audio/bgm/luxury-brand.mp3', isPro: true },
  { id: 'luxury-2', name: 'Premium Feel', genre: 'luxury', duration: 60, url: '/audio/bgm/premium-feel.mp3', isPro: true },
]

// GET /api/movie/bgm - プランに応じてBGMをフィルタして返す
export async function GET(req: NextRequest) {
  try {
    // ユーザーのプランを取得
    let userPlan = 'FREE'
    const session = await getServerSession(authOptions)
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      if (user) {
        const subscription = await prisma.userServiceSubscription.findUnique({
          where: { userId_serviceId: { userId: user.id, serviceId: 'movie' } },
        })
        userPlan = subscription?.plan ?? 'FREE'
      }
    }

    const userIsPro = isProPlan(userPlan)

    // 全BGMを返すが、Freeユーザーにはlockedフラグを付与
    const tracks = BGM_TRACKS.map(track => ({
      ...track,
      locked: track.isPro && !userIsPro,
    }))

    // Freeユーザーの場合はisPro === falseのもののみ返す
    const filteredTracks = userIsPro
      ? tracks
      : tracks.filter(t => !t.isPro)

    return NextResponse.json({ tracks: filteredTracks, plan: userPlan })
  } catch (error) {
    console.error('[GET /api/movie/bgm]', error)
    return NextResponse.json({ error: 'BGMの取得に失敗しました' }, { status: 500 })
  }
}
