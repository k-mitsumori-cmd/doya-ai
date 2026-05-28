export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

async function loadOwnedCompany(userId: string, companyId: string) {
  const company = await prisma.doyalistCompany.findUnique({
    where: { id: companyId },
    include: { project: { select: { userId: true } } },
  })
  if (!company) return { error: '企業が見つかりません', status: 404 as const }
  if (company.project.userId !== userId) {
    return { error: 'アクセス権がありません', status: 403 as const }
  }
  return { company }
}

/**
 * PATCH /api/doyalist/companies/[id]
 * 企業情報を更新（status, notes, 連絡先など）
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const id = await resolveId(ctx)
    const guard = await loadOwnedCompany(userId, id)
    if ('error' in guard) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const body = await req.json()
    const data: Record<string, any> = {}
    const fields = [
      'name', 'website', 'industry', 'region', 'size', 'description',
      'contactEmail', 'contactPhone', 'contactPerson', 'notes', 'score', 'status',
    ]
    // バリデーション
    const ALLOWED_STATUS = ['new', 'contacted', 'replied', 'won', 'lost']
    if (body.status !== undefined && !ALLOWED_STATUS.includes(body.status)) {
      return NextResponse.json({ error: '無効なステータスです' }, { status: 400 })
    }
    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.length > 200)) {
      return NextResponse.json({ error: '企業名は200文字以内で入力してください' }, { status: 400 })
    }
    if (body.contactEmail && typeof body.contactEmail === 'string' && body.contactEmail.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contactEmail)) {
        return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
      }
    }
    if (body.contactPhone && typeof body.contactPhone === 'string' && body.contactPhone.trim()) {
      if (!/^[\d\-+() ]{6,20}$/.test(body.contactPhone)) {
        return NextResponse.json({ error: '電話番号の形式が正しくありません' }, { status: 400 })
      }
    }
    if (body.website && typeof body.website === 'string' && body.website.trim()) {
      try {
        const u = new URL(body.website)
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error()
      } catch {
        return NextResponse.json({ error: 'WebサイトURLの形式が正しくありません（http/httpsのみ）' }, { status: 400 })
      }
    }
    if (body.score !== undefined && (typeof body.score !== 'number' || body.score < 0 || body.score > 100)) {
      return NextResponse.json({ error: 'スコアは0-100の数値で指定してください' }, { status: 400 })
    }
    for (const k of fields) {
      if (body[k] !== undefined) data[k] = body[k]
    }

    const company = await prisma.doyalistCompany.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, company })
  } catch (e: any) {
    console.error('[doyalist/companies/[id]][PATCH]', e)
    return NextResponse.json(
      { error: e?.message || '企業の更新に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/doyalist/companies/[id]
 * 企業を削除
 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const id = await resolveId(ctx)
    const guard = await loadOwnedCompany(userId, id)
    if ('error' in guard) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    await prisma.doyalistCompany.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[doyalist/companies/[id]][DELETE]', e)
    return NextResponse.json(
      { error: e?.message || '企業の削除に失敗しました' },
      { status: 500 }
    )
  }
}
