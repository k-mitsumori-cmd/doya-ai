// ============================================
// 新しい見た目のプレビューを切り替える
// ============================================
// GET /api/ui-preview?on=1 … 新しい見た目にする / ?on=0 … 今の見た目に戻す
// ?next=/home のように、戻る先のパスを渡せる（同じサイトの中だけ）。無ければ元のページ（Referer）か /home。
// ⚠️ ログイン中で、メールが UI_PREVIEW_EMAILS にある人だけが使える。それ以外は 403。
// ⚠️ cookie を立てても、表示の判定（src/lib/ui-next.ts）は毎回メールを確かめる。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canPreviewUiNext, safeReturnPath, UI_NEXT_COOKIE, UI_NEXT_COOKIE_MAX_AGE } from '@/lib/ui-next'

function returnPath(req: NextRequest): string {
  const next = req.nextUrl.searchParams.get('next')
  if (next) return safeReturnPath(next)
  const referer = req.headers.get('referer')
  if (referer) {
    try {
      const u = new URL(referer)
      if (u.origin === req.nextUrl.origin) return safeReturnPath(u.pathname + u.search)
    } catch {
      // 読めない Referer は使わない
    }
  }
  return '/home'
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions).catch(() => null)
  if (!canPreviewUiNext(session?.user?.email)) {
    return NextResponse.json({ error: 'この切り替えは使えません' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
  const on = req.nextUrl.searchParams.get('on') === '1'
  const res = NextResponse.redirect(new URL(returnPath(req), req.nextUrl.origin), 303)
  res.headers.set('Cache-Control', 'no-store')
  if (on) {
    res.cookies.set(UI_NEXT_COOKIE, '1', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: UI_NEXT_COOKIE_MAX_AGE,
    })
  } else {
    res.cookies.set(UI_NEXT_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  }
  return res
}
