export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function retryClientTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit() }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error
      if (attempt === 2) throw new Error('同時に顧客情報が変更されました')
    }
  }
  throw new Error('顧客情報を変更できませんでした')
}

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

    if (typeof workspaceSlug !== 'string' || !workspaceSlug.trim() || workspaceSlug.length > 200) {
      return NextResponse.json({ error: 'workspaceSlug は必須です' }, { status: 400 })
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '会社名は必須です' }, { status: 400 })
    }
    if (name.length > 200) {
      return NextResponse.json({ error: '会社名は200文字以内' }, { status: 400 })
    }
    if ([contactName, email, phone, address, note].some(value => value != null && typeof value !== 'string')) {
      return NextResponse.json({ error: '顧客情報の形式が不正です' }, { status: 400 })
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'メールアドレスの形式が不正です' }, { status: 400 })
    }

    const result = await retryClientTransaction(() => prisma.$transaction(async tx => {
      const workspace = await tx.promaneWorkspace.findFirst({
        where: { slug: workspaceSlug, members: { some: { userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } } } },
        select: { id: true },
      })
      if (!workspace) return { status: 403 as const, error: 'ワークスペースにアクセスできません' }
      const client = await tx.promaneClient.create({
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
      return { status: 200 as const, client }
    }, { isolationLevel: 'Serializable' }))
    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, client: result.client })
  } catch (e: any) {
    console.error('[promane/clients][POST]')
    return NextResponse.json(
      { error: '顧客の追加に失敗しました' },
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

    const result = await retryClientTransaction(() => prisma.$transaction(async tx => {
      const workspace = await tx.promaneWorkspace.findFirst({
        where: { slug: workspaceSlug, members: { some: { userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } } } },
        select: { id: true },
      })
      if (!workspace) return { status: 403 as const, error: 'ワークスペースにアクセスできません' }
      const deleted = await tx.promaneClient.deleteMany({ where: { id, workspaceId: workspace.id } })
      if (deleted.count !== 1) return { status: 404 as const, error: '顧客が見つかりません' }
      return { status: 200 as const }
    }, { isolationLevel: 'Serializable' }))
    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[promane/clients][DELETE]')
    return NextResponse.json(
      { error: '削除に失敗しました' },
      { status: 500 }
    )
  }
}
