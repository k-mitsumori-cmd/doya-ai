export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================
// 埋め込みタグ用: 表示・クリック・閉じるの計測（ログイン不要・第三者のサイトから呼ばれる）
// ============================================
// ⚠️ 加算するのは「そのサイトキーのサイトの、公開中の案」で、呼び出し元が登録ドメインのときだけ。
// ⚠️ 本文は text/plain の JSON（sendBeacon はプリフライト無しで送れる形しか使えない）。2KBまで。
// ⚠️ IP・Cookie・UA は保存しない。下の回数制限もメモリ上だけで使い、どこにも書かない。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isId, isSiteKey, sanitizeTarget, TRACK_EVENTS, type TrackEvent } from '@/lib/popup/schema'
import { incrementStat } from '@/lib/popup/stats'
import { callerAllowed, corsHeaders, preflightHeaders } from '@/lib/popup/public'

const MAX_BODY = 2048

/**
 * 1つの接続元からの送信回数の上限（1分あたり）。サーバのインスタンスごとの目安で、厳密ではない。
 * 通常の閲覧では1ページで多くて3回（表示・クリック・閉じる）しか送らない。
 */
const PER_MINUTE = 60
const hits = new Map<string, { n: number; at: number }>()

function overLimit(key: string): boolean {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || now - h.at > 60_000) {
    if (hits.size > 5000) hits.clear()
    hits.set(key, { n: 1, at: now })
    return false
  }
  h.n++
  return h.n > PER_MINUTE
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: preflightHeaders(req) })
}

export async function POST(req: NextRequest) {
  const noStore = { 'Cache-Control': 'no-store' }
  const len = Number(req.headers.get('content-length') || 0)
  if (len > MAX_BODY) return new NextResponse(null, { status: 413, headers: noStore })
  const text = await req.text().catch(() => '')
  if (!text || text.length > MAX_BODY) return new NextResponse(null, { status: 400, headers: noStore })

  let body: { k?: unknown; p?: unknown; e?: unknown; t?: unknown }
  try {
    body = JSON.parse(text)
  } catch {
    return new NextResponse(null, { status: 400, headers: noStore })
  }
  const target = sanitizeTarget(body.t)
  if (!isSiteKey(body.k) || !isId(body.p) || !TRACK_EVENTS.includes(body.e as TrackEvent) || !target) {
    return new NextResponse(null, { status: 400, headers: noStore })
  }
  // 表示と閉じるは本体（main）だけに数える
  if (body.e !== 'click' && target !== 'main') return new NextResponse(null, { status: 400, headers: noStore })

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  if (overLimit(`${ip}:${body.p}`)) return new NextResponse(null, { status: 429, headers: noStore })

  const popup = await prisma.popup.findFirst({
    where: { id: body.p, status: 'live', site: { siteKey: body.k, deletedAt: null } },
    select: { id: true, site: { select: { domain: true } } },
  })
  if (!popup) return new NextResponse(null, { status: 404, headers: noStore })
  const allowed = callerAllowed(req, popup.site.domain)
  if (!allowed) return new NextResponse(null, { status: 403, headers: noStore })

  try {
    await incrementStat(popup.id, body.e as TrackEvent, target)
  } catch (e) {
    console.error('[popup] track failed', (e as Error)?.name)
    return new NextResponse(null, { status: 500, headers: { ...noStore, ...corsHeaders(req, true) } })
  }
  return new NextResponse(null, { status: 204, headers: { ...noStore, ...corsHeaders(req, true) } })
}
