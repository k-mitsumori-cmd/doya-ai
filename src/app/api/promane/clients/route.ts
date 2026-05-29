export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/promane/clients
 * 顧客を作成
 * Body: { workspaceSlug, name, contactName?, email?, phone?, address?, note? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインセッションが切れています' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { workspaceSlug, name, contactName, email, phone, address, note } = body || {}

    if (!workspaceSlug) {
      return NextResponse.json({ error: 'workspaceSlug は必須です' }, { status: 400 })
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '会社名は必須です' }, { status: 400 })
    }
    if (name.length > 200) {
      return NextResponse.json({ error: '会社名は200文字以内' }, { status: 400 })
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'メールアドレスの形式が不正です' }, { status: 400 })
    }

    // ワークスペース所属確認
    const workspace = await prisma.promaneWorkspace.findFirst({
      where: {
        slug: workspaceSlug,
        members: { some: { userId, isActive: true } },
      },
      select: { id: true },
    })
    if (!workspace) {
      return NextResponse.json({ error: 'ワークスペースにアクセスできません' }, { status: 403 })
    }

    const client = await prisma.promaneClient.create({
      data: {
        workspaceId: workspace.id,
        name: name.trim(),
        contactName: contactName?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        note: note?.slice(0, 5000) || null,
      },
    })

    return NextResponse.json({ success: true, client })
  } catch (e: any) {
    console.error('[promane/clients][POST]', e)
    return NextResponse.json(
      { error: e?.message || '顧客の追加に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/promane/clients?workspaceSlug=...&id=...
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインセッションが切れています' }, { status: 401 })
    }

    const workspaceSlug = req.nextUrl.searchParams.get('workspaceSlug')
    const id = req.nextUrl.searchParams.get('id')
    if (!workspaceSlug || !id) {
      return NextResponse.json({ error: 'workspaceSlug と id は必須です' }, { status: 400 })
    }

    const workspace = await prisma.promaneWorkspace.findFirst({
      where: { slug: workspaceSlug, members: { some: { userId, isActive: true } } },
      select: { id: true },
    })
    if (!workspace) {
      return NextResponse.json({ error: 'ワークスペースにアクセスできません' }, { status: 403 })
    }

    // クライアントの workspace 所属確認
    const client = await prisma.promaneClient.findFirst({
      where: { id, workspaceId: workspace.id },
      select: { id: true },
    })
    if (!client) {
      return NextResponse.json({ error: '顧客が見つかりません' }, { status: 404 })
    }

    await prisma.promaneClient.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[promane/clients][DELETE]', e)
    return NextResponse.json(
      { error: e?.message || '削除に失敗しました' },
      { status: 500 }
    )
  }
}
