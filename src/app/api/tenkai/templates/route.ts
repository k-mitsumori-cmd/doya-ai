// ============================================
// GET / POST /api/tenkai/templates
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SUPPORTED_PLATFORMS } from '@/lib/tenkai/prompts/system'

/**
 * GET — テンプレート一覧（システム + カスタム）
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const { searchParams } = new URL(req.url)
    const platform = searchParams.get('platform') || undefined

    const where: Record<string, unknown> = {
      OR: [
        { isSystem: true },
        { userId },
      ],
    }
    if (platform) {
      where.platform = platform
    }

    const templates = await prisma.tenkaiTemplate.findMany({
      where,
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        platform: t.platform,
        name: t.name,
        description: t.description,
        promptOverride: t.promptOverride,
        structureHint: t.structureHint,
        isSystem: t.isSystem,
        isOwned: t.userId === userId,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] templates list error:', message)
    return NextResponse.json(
      { error: message || 'テンプレート一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * POST — テンプレート新規作成
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    const { platform, name, description, promptOverride, structureHint } = body

    if (!platform || !SUPPORTED_PLATFORMS.includes(platform)) {
      return NextResponse.json(
        { error: `プラットフォームは ${SUPPORTED_PLATFORMS.join(', ')} のいずれかです` },
        { status: 400 }
      )
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'テンプレート名は必須です' }, { status: 400 })
    }

    const template = await prisma.tenkaiTemplate.create({
      data: {
        userId,
        platform,
        name: name.trim(),
        description: description || null,
        promptOverride: promptOverride || null,
        structureHint: structureHint || null,
        isSystem: false,
      },
    })

    return NextResponse.json({
      template: {
        id: template.id,
        platform: template.platform,
        name: template.name,
        isSystem: template.isSystem,
        createdAt: template.createdAt.toISOString(),
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] template create error:', message)
    return NextResponse.json(
      { error: message || 'テンプレート作成に失敗しました' },
      { status: 500 }
    )
  }
}
