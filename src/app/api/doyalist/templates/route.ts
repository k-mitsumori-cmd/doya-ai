export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_TYPES = ['email', 'dm', 'phone', 'letter']

/**
 * GET /api/doyalist/templates?type=email
 * ユーザーのテンプレート一覧（type指定可、type別グルーピング）
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || undefined

    const where: any = { userId }
    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `typeは${VALID_TYPES.join(', ')}のいずれかを指定してください` },
          { status: 400 }
        )
      }
      where.type = type
    }

    const templates = await prisma.doyalistTemplate.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    // typeでグルーピング
    const byType: Record<string, typeof templates> = {}
    for (const t of templates) {
      ;(byType[t.type] ||= []).push(t)
    }

    return NextResponse.json({ success: true, templates, byType })
  } catch (e: any) {
    console.error('[doyalist/templates][GET]', e)
    return NextResponse.json(
      { error: e?.message || 'テンプレートの取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/doyalist/templates
 * Body: { name, type, subject?, body, isDefault? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { name, type, subject, body: tplBody, isDefault } = body || {}

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'テンプレート名は必須です' }, { status: 400 })
    }
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `typeは${VALID_TYPES.join(', ')}のいずれかを指定してください` },
        { status: 400 }
      )
    }
    if (!tplBody || typeof tplBody !== 'string' || tplBody.trim().length === 0) {
      return NextResponse.json({ error: '本文は必須です' }, { status: 400 })
    }

    // isDefault=trueなら、同タイプの既存デフォルトを解除
    if (isDefault === true) {
      await prisma.doyalistTemplate.updateMany({
        where: { userId, type, isDefault: true },
        data: { isDefault: false },
      })
    }

    const template = await prisma.doyalistTemplate.create({
      data: {
        userId,
        name: name.trim(),
        type,
        subject: subject ? String(subject) : null,
        body: tplBody,
        isDefault: isDefault === true,
      },
    })

    return NextResponse.json({ success: true, template })
  } catch (e: any) {
    console.error('[doyalist/templates][POST]', e)
    return NextResponse.json(
      { error: e?.message || 'テンプレートの作成に失敗しました' },
      { status: 500 }
    )
  }
}
