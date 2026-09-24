export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserPromaneLimits, countUserWorkspaces } from '@/lib/promane/limits'
import { recordServiceUsage } from '@/lib/service-usage'
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

    // 同じユーザーの作成を直列化し、プラン照会・件数・作成を同じトランザクションに収める。
    const result = await prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
      if (users.length === 0) throw new Error('Promane account not found')
      const limits = await getUserPromaneLimits(userId, tx)
      const current = await countUserWorkspaces(userId, tx)
      if (limits.maxWorkspaces >= 0 && current >= limits.maxWorkspaces) {
        return { limits, workspace: null }
      }
      const user = await tx.user.findUnique({ where: { id: userId }, select: { name: true } })
      const workspace = await tx.promaneWorkspace.create({
        data: {
          userId,
          name,
          slug: `ws-${crypto.randomBytes(8).toString('hex')}`,
          members: { create: { userId, role: 'owner', displayName: user?.name || 'オーナー' } },
        },
        select: { id: true, slug: true, name: true },
      })
      return { limits, workspace }
    })
    if (!result.workspace) {
      const { limits } = result
      const canUpgrade = limits.tier === 'FREE' || limits.tier === 'LIGHT'
      return NextResponse.json({
        error: canUpgrade
          ? `作成できるワークスペースは${limits.maxWorkspaces}個までです。プランを変更すると上限を増やせます。`
          : `作成できるワークスペースは${limits.maxWorkspaces}個までです。追加が必要な場合はお問い合わせください。`,
        code: 'LIMIT_REACHED',
        limit: limits.maxWorkspaces,
        ...(canUpgrade ? { upgradeUrl: '/promane/pricing' } : { contactUrl: 'https://doyamarke.surisuta.jp/contact' }),
      }, { status: 403 })
    }
    const workspace = result.workspace

    await recordServiceUsage({
      userId,
      serviceId: 'promane',
      action: 'ワークスペース作成',
      summary: workspace.name,
      metadata: { workspaceId: workspace.id },
    })

    return NextResponse.json({ success: true, workspace })
  } catch (e: any) {
    console.error('[promane/workspaces/create]', e)
    return NextResponse.json(
      { error: 'ワークスペース作成に失敗しました。時間をおいて再試行してください' },
      { status: 500 }
    )
  }
}
