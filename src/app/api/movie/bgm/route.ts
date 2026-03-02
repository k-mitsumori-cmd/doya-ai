import { NextResponse } from 'next/server'
import type { BgmTrack } from '@/lib/movie/types'

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

// GET /api/movie/bgm
export async function GET() {
  return NextResponse.json({ tracks: BGM_TRACKS })
}
