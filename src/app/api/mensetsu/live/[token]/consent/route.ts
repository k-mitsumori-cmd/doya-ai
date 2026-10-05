export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/live/[token]/consent — 同意の記録（C1）
// 録音・AI評価・保持期間を提示したうえでの明示同意。同意ログを保存する。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertUsable, loadSessionByToken, toPublicSession } from '@/lib/mensetsu/public'

type Ctx = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })

  const usable = assertUsable(s)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  const body = await req.json().catch(() => ({}))
  if (body?.agreed !== true) {
    return NextResponse.json({ error: '同意が必要です' }, { status: 400 })
  }

  // 再送や別タブからの同意で、実施中の状態や初回の同意記録を戻さない。
  if (s.consentedAt) return NextResponse.json({ session: toPublicSession(s) })
  if (s.startedAt || s.endedAt || !['pending', 'consented'].includes(s.status)) {
    return NextResponse.json({ error: '面接の状態が変わりました。再読み込みしてください。' }, { status: 409 })
  }

  const name = String(body?.candidateName || '').trim()

  // ⚠️ 以前はここで「ご本人確認用メール」の照合を行っていたが、
  //    採用担当者と応募者の双方にとって手順が分かりにくく、
  //    2026-08-31 に機能ごと廃止した（DBの列は復帰の余地のため残してある）。

  const saved = await prisma.mensetsuSession.updateMany({
    where: {
      id: s.id, status: { in: ['pending', 'consented'] },
      startedAt: null, endedAt: null, consentedAt: null,
      expiresAt: { gt: new Date() }, updatedAt: s.updatedAt,
    },
    data: {
      status: 'consented',
      consentedAt: new Date(),
      consentIp:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        null,
      consentUa: req.headers.get('user-agent') || null,
      ...(name ? { candidateName: name } : {}),
    },
  })
  const current = await loadSessionByToken(p.token)
  if (!current) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  const currentUsable = assertUsable(current)
  if (!currentUsable.ok) return NextResponse.json({ error: currentUsable.reason }, { status: currentUsable.status })
  if (!current.consentedAt) {
    return NextResponse.json({ error: '面接の状態が変わりました。再読み込みしてください。' }, { status: 409 })
  }
  // 同時の同意リクエストが先に成功した場合も、その初回記録を返す。
  if (saved.count !== 1 && !['consented', 'live'].includes(current.status)) {
    return NextResponse.json({ error: '面接の状態が変わりました。再読み込みしてください。' }, { status: 409 })
  }
  return NextResponse.json({ session: toPublicSession(current) })
}
