// ============================================
// GET /api/voice/speakers — スピーカー一覧
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAllSpeakers } from '@/lib/voice/speakers'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    const isPro = ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(
      String(user?.voicePlan || user?.plan || '').toUpperCase()
    )

    const speakers = getAllSpeakers().map((s) => ({
      ...s,
      locked: s.isPro && !isPro,
    }))

    return NextResponse.json({ success: true, speakers })
  } catch (error) {
    console.error('Speakers API error:', error)
    return NextResponse.json(
      { success: false, error: 'スピーカー一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}
