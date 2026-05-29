export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserPromaneLimits, countUserWorkspaces } from '@/lib/promane/limits'
import crypto from 'crypto'

/**
 * POST /api/promane/workspaces/create
 * 新規ワークスペース作成
 * Body: { name: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const name = String(body?.name || '').trim()
    if (!name) {
      return NextResponse.json({ error: 'ワークスペース名は必須です' }, { status: 400 })
    }
    if (name.length > 100) {
      return NextResponse.json({ error: 'ワークスペース名は100文字以内' }, { status: 400 })
    }

    // プラン上限チェック
    const limits = await getUserPromaneLimits(userId)
    if (limits.maxWorkspaces > 0) {
      const current = await countUserWorkspaces(userId)
      if (current >= limits.maxWorkspaces) {
        return NextResponse.json(
          { error: `プラン上限 (${limits.maxWorkspaces}個) に達しました。アップグレードしてください` },
          { status: 403 }
        )
      }
    }

    // slug 自動生成（ユニークになるまで再試行）
    const baseSlug = `ws-${crypto.randomBytes(4).toString('hex')}`
    let slug = baseSlug
    let suffix = 0
    while (await prisma.promaneWorkspace.findFirst({ where: { slug }, select: { id: true } })) {
      suffix++
      slug = `${baseSlug}-${suffix}`
      if (suffix > 10) {
        return NextResponse.json({ error: 'スラッグ生成に失敗しました。再試行してください' }, { status: 500 })
      }
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })

    const workspace = await prisma.promaneWorkspace.create({
      data: {
        userId,
        name,
        slug,
        members: {
          create: {
            userId,
            role: 'owner',
            displayName: user?.name || 'オーナー',
          },
        },
      },
      select: { id: true, slug: true, name: true },
    })

    return NextResponse.json({ success: true, workspace })
  } catch (e: any) {
    console.error('[promane/workspaces/create]', e)
    return NextResponse.json(
      { error: e?.message || 'ワークスペース作成に失敗しました' },
      { status: 500 }
    )
  }
}
