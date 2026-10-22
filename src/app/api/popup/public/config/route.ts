export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================
// 埋め込みタグ用: 公開中のポップアップの設定（ログイン不要・第三者のサイトから呼ばれる）
// ============================================
// ⚠️ 呼び出し元のホストが登録ドメイン（とそのサブドメイン）のときだけ返す。
// ⚠️ 返すのは表示に必要な項目だけ（toEmbedPopup）。
// ⚠️ CDN に60秒キャッシュさせる。embed.js は h（呼び出し元のホスト）をクエリに付けるので、
//    ホストごとにキャッシュが分かれ、別ホスト向けの CORS ヘッダが返ることは無い。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSiteKey } from '@/lib/popup/schema'
import { appOrigin, toEmbedPopup } from '@/lib/popup/dto'
import { callerAllowed, corsHeaders, preflightHeaders, SEEN_INTERVAL_MS } from '@/lib/popup/public'

const MAX_LIVE = 20

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: preflightHeaders(req) })
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('k')
  if (!isSiteKey(key)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { Vary: 'Origin' } })

  const site = await prisma.popupSite.findUnique({
    where: { siteKey: key },
    select: { id: true, domain: true, deletedAt: true, lastSeenAt: true },
  })
  if (!site || site.deletedAt) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { Vary: 'Origin' } })

  const allowed = callerAllowed(req, site.domain)
  if (!allowed) {
    // CORS ヘッダを付けないので、ブラウザは中身を読めない
    return NextResponse.json({ error: 'domain_mismatch' }, { status: 403, headers: { Vary: 'Origin', 'Cache-Control': 'no-store' } })
  }

  const popups = await prisma.popup.findMany({
    where: { siteId: site.id, status: 'live' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: MAX_LIVE,
    select: { id: true, kind: true, creative: true, trigger: true, targeting: true, frequency: true },
  })

  // 設置確認。10分に1回まで（毎回書くと表示のたびに書き込みが走る）
  const now = Date.now()
  if (!site.lastSeenAt || now - site.lastSeenAt.getTime() > SEEN_INTERVAL_MS) {
    void prisma.popupSite
      .updateMany({ where: { id: site.id, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(now - SEEN_INTERVAL_MS) } }] }, data: { lastSeenAt: new Date(now) } })
      .catch(() => {})
  }

  return NextResponse.json(
    { v: 1, track: `${appOrigin()}/api/popup/public/track`, popups: popups.map((p) => toEmbedPopup(p)) },
    {
      headers: {
        ...corsHeaders(req, true),
        'Cache-Control': 'public, max-age=0, s-maxage=60',
      },
    }
  )
}
