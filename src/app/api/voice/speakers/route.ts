// ============================================
// GET /api/voice/speakers — スピーカー一覧
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAllSpeakers } from '@/lib/voice/speakers'
import { isVoiceProFromUser } from '@/lib/voice/plans'
import { SERVICE_RETIRED, retiredServiceResponse } from '@/lib/retired-service'

export async function GET() {
  // ⚠️ 提供終了。入口だけ閉じる（本体とデータは復旧の余地のため残す）
  if (SERVICE_RETIRED) return retiredServiceResponse('ドヤボイスAI')

  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    const isPro = isVoiceProFromUser(user)

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
