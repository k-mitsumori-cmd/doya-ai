export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/live/[token]/consent — 同意の記録（C1）
// 録音・AI評価・保持期間を提示したうえでの明示同意。同意ログを保存する。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertUsable, loadSessionByToken, toPublicSession } from '@/lib/mensetsu/public'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })

  const usable = assertUsable(s)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  const body = await req.json().catch(() => ({}))
  if (body?.agreed !== true) {
    return NextResponse.json({ error: '同意が必要です' }, { status: 400 })
  }

  const name = String(body?.candidateName || '').trim()

  const updated = await prisma.mensetsuSession.update({
    where: { id: s.id },
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

  return NextResponse.json({ session: toPublicSession({ ...s, ...updated } as any) })
}
