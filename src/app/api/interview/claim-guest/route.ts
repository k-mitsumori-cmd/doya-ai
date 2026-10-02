import { NextRequest, NextResponse } from 'next/server'
import { getGuestIdFromRequest, getInterviewUser, INTERVIEW_GUEST_COOKIE, requireDatabase } from '@/lib/interview/access'
import { claimInterviewGuestProjects } from '@/lib/interview/guest-claim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin || origin !== req.nextUrl.origin) {
    return NextResponse.json({ success: false, error: '操作元を確認できませんでした。' }, { status: 403 })
  }
  const { userId } = await getInterviewUser()
  if (!userId) return NextResponse.json({ success: false, error: 'ログインが必要です。' }, { status: 401 })
  const dbError = requireDatabase()
  if (dbError) return dbError
  const guestId = getGuestIdFromRequest(req)
  if (!guestId) {
    const res = NextResponse.json({ success: true, claimed: 0 })
    res.cookies.delete(INTERVIEW_GUEST_COOKIE)
    return res
  }
  try {
    const result = await claimInterviewGuestProjects(userId, guestId)
    if (result.state === 'busy') {
      return NextResponse.json({
        success: false,
        code: 'GUEST_PROJECT_BUSY',
        error: 'ゲストプロジェクトの処理が進行中です。完了後に引き継ぎを再試行してください。',
      }, { status: 409 })
    }
    const res = NextResponse.json({ success: true, claimed: result.count })
    res.cookies.delete(INTERVIEW_GUEST_COOKIE)
    return res
  } catch {
    console.error('[interview/claim-guest] failed')
    return NextResponse.json({
      success: false,
      error: 'ゲストプロジェクトを引き継げませんでした。時間をおいて再試行してください。',
    }, { status: 503 })
  }
}
