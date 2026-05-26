export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/hr/organization/invite/[token]
// 招待情報を取得（認証不要 — 招待ページ表示用）
type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const token = p.token

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const invitation = await prisma.hrInvitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: '招待が見つかりません' }, { status: 404 })
    }

    // 期限切れチェック
    const expired = new Date() > invitation.expiresAt
    if (expired && invitation.status === 'PENDING') {
      await prisma.hrInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      })
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: expired ? 'EXPIRED' : invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
        organization: {
          id: invitation.organization.id,
          name: invitation.organization.name,
          slug: invitation.organization.slug,
          logoUrl: invitation.organization.logoUrl,
        },
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch invitation' },
      { status: 500 }
    )
  }
}
