export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { OperationalBodyError, readOperationalJson } from '@/lib/operational-json'
import { allowAioPreview } from '@/lib/aio/preview-limit'
import { normalizeUrl } from '@/lib/aio/suggest'
import { analyzeSite } from '@/lib/aio/site-analysis'
import { UNREADABLE_MESSAGE, unreadableDetail } from '@/lib/aio/site-reader'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

// POST /api/aio/quick-start/preview — 組織を作らずに、サイトから読み取れたサービスの内容を返す（確認画面用）
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id && !session?.user?.email) return NextResponse.json({ error: '認証が必要です' }, { status: 401, headers })
    if (!allowAioPreview(session.user.id || session.user.email || '')) return NextResponse.json({ error: '読み取りの回数が多すぎます。しばらくしてからもう一度お試しください。' }, { status: 429, headers })
    const body = await readOperationalJson(req, 4096)
    if (typeof body?.url !== 'string' || body.url.length > 2048) return NextResponse.json({ error: '有効なURLを入力してください' }, { status: 400, headers })
    const url = normalizeUrl(body.url)
    if (!url) return NextResponse.json({ error: '有効なURLを入力してください' }, { status: 400, headers })
    const { read, profile, usable } = await analyzeSite(url)
    const r = read.readability
    const summary = { bodyChars: r.bodyChars, totalChars: r.totalChars, sources: r.sources, pagesRead: read.pages.map(p => p.url).slice(0, 6) }
    if (!usable || !profile) {
      return NextResponse.json({ readable: false, message: UNREADABLE_MESSAGE, detail: unreadableDetail(read), read: summary }, { headers })
    }
    return NextResponse.json({ readable: true, profile: { summary: profile.summary, audience: profile.audience, industry: profile.industry, competitorKind: profile.competitorKind, evidence: profile.evidence }, read: summary }, { headers })
  } catch (error) {
    if (error instanceof OperationalBodyError) return NextResponse.json({ error: '入力形式またはサイズを確認してください' }, { status: error.status, headers })
    console.error('[aio/quick-start/preview]')
    return NextResponse.json({ error: 'サイトを読み取れませんでした。しばらくしてからもう一度お試しください。' }, { status: 500, headers })
  }
}
