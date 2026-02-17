// ============================================
// GET/POST /api/tenkai/api-key
// ============================================
// APIキーの取得・新規生成

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes, createHash } from 'crypto'
import { getTenkaiPlan } from '@/lib/tenkai/access'

/**
 * APIキーを生成（表示は生成時のみ）
 */
function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const bytes = randomBytes(32)
  const raw = `sk-doya-${bytes.toString('hex')}`
  const prefix = raw.slice(0, 12)
  const hash = createHash('sha256').update(raw).digest('hex')
  return { raw, prefix, hash }
}

// GET: 現在のAPIキー情報を取得
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    // Pro以上のプランチェック（tenkai固有プランを使用）
    const plan = await getTenkaiPlan(userId)
    if (plan !== 'PRO' && plan !== 'ENTERPRISE') {
      return NextResponse.json(
        { error: 'APIアクセスはPro以上のプランで利用可能です' },
        { status: 403 }
      )
    }

    const apiKey = await prisma.tenkaiApiKey.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    if (!apiKey) {
      return NextResponse.json({ apiKey: null })
    }

    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        prefix: apiKey.keyPrefix,
        maskedKey: `${apiKey.keyPrefix}${'•'.repeat(60)}`,
        lastUsedAt: apiKey.lastUsedAt?.toISOString() || null,
        createdAt: apiKey.createdAt.toISOString(),
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'APIキー取得に失敗しました'
    console.error('[tenkai] api-key GET error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: 新規APIキーを生成（既存キーは無効化）
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    // Pro以上のプランチェック（tenkai固有プランを使用）
    const plan = await getTenkaiPlan(userId)
    if (plan !== 'PRO' && plan !== 'ENTERPRISE') {
      return NextResponse.json(
        { error: 'APIアクセスはPro以上のプランで利用可能です' },
        { status: 403 }
      )
    }

    // 新しいキーを生成
    const { raw, prefix, hash } = generateApiKey()

    // トランザクションで既存キーを無効化して新規作成
    await prisma.$transaction([
      prisma.tenkaiApiKey.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      }),
      prisma.tenkaiApiKey.create({
        data: {
          userId,
          keyPrefix: prefix,
          keyHash: hash,
          isActive: true,
        },
      }),
    ])

    // 生成直後のみ完全なキーを返す
    return NextResponse.json({
      apiKey: raw,
      prefix,
      message: 'このAPIキーは一度しか表示されません。安全な場所に保存してください。',
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'APIキー生成に失敗しました'
    console.error('[tenkai] api-key POST error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
