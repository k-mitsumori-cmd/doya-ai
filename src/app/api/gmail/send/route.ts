export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GmailSendError, sendGmail } from '@/lib/gmail/send'

// 利用者が確認画面で「送信する」を押したときだけ呼ばれる。AI・cron からは呼ばない。
export async function POST(req: NextRequest) {
  // CSRF 対策: JSON のみ受け付け、同一サイトからの要求だけ通す
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: '不正な要求です' }, { status: 415 })
  }
  const site = req.headers.get('sec-fetch-site')
  const origin = req.headers.get('origin')
  if ((site && site !== 'same-origin') || (origin && origin !== req.nextUrl.origin)) {
    return NextResponse.json({ error: '不正な要求です' }, { status: 403 })
  }
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || body.confirmed !== true) {
    return NextResponse.json({ error: '送信の確認が必要です' }, { status: 400 })
  }
  try {
    const r = await sendGmail({
      userId,
      to: String(body.to || ''),
      subject: String(body.subject || ''),
      text: String(body.text || ''),
      replyTo: body.replyTo ? String(body.replyTo) : undefined,
      source: typeof body.source === 'string' ? body.source.slice(0, 50) : undefined,
    })
    return NextResponse.json({ success: true, ...r })
  } catch (e) {
    if (e instanceof GmailSendError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
    }
    console.error('[gmail/send] unexpected error')
    return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 })
  }
}
