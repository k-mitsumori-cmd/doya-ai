import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET: テンプレート一覧
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const templates = await prisma.dripTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { steps: true } },
      },
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('[Drip] Templates list error:', error)
    return NextResponse.json({ error: 'テンプレート一覧の取得に失敗しました' }, { status: 500 })
  }
}

// POST: テンプレート作成
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { name, subject, bodyHtml, bodyText, variables } = body

    if (!name || !subject || !bodyHtml) {
      return NextResponse.json(
        { error: 'name, subject, bodyHtml は必須です' },
        { status: 400 }
      )
    }

    const template = await prisma.dripTemplate.create({
      data: {
        name,
        subject,
        bodyHtml,
        bodyText: bodyText || null,
        variables: variables || [],
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('[Drip] Template create error:', error)
    return NextResponse.json({ error: 'テンプレートの作成に失敗しました' }, { status: 500 })
  }
}
