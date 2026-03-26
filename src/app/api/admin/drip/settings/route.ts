import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SETTING_KEYS = [
  'fromName',
  'fromEmail',
  'replyTo',
  'timezone',
  'sendWindowStart',
  'sendWindowEnd',
  'rateLimit',
  'unsubscribeEnabled',
] as const

const DEFAULT_SETTINGS: Record<string, any> = {
  fromName: 'ドヤAI',
  fromEmail: 'noreply@doya-ai.surisuta.jp',
  replyTo: '',
  timezone: 'Asia/Tokyo',
  sendWindowStart: '09:00',
  sendWindowEnd: '21:00',
  rateLimit: 100,
  unsubscribeEnabled: true,
}

// GET: ドリップ設定一覧
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const settings = await prisma.dripSetting.findMany({
      where: { key: { in: [...SETTING_KEYS] } },
    })

    // DB の値とデフォルト値をマージ
    const result: Record<string, any> = { ...DEFAULT_SETTINGS }
    for (const setting of settings) {
      result[setting.key] = setting.value
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Drip] Settings get error:', error)
    return NextResponse.json({ error: '設定の取得に失敗しました' }, { status: 500 })
  }
}

// PUT: ドリップ設定更新（各キーを upsert）
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const body = await request.json()

    // 各キーを upsert
    const upserts = Object.entries(body)
      .filter(([key]) => (SETTING_KEYS as readonly string[]).includes(key))
      .map(([key, value]) =>
        prisma.dripSetting.upsert({
          where: { key },
          create: { key, value: value as any },
          update: { value: value as any },
        })
      )

    await prisma.$transaction(upserts)

    // 更新後の設定を返す
    const settings = await prisma.dripSetting.findMany({
      where: { key: { in: [...SETTING_KEYS] } },
    })

    const result: Record<string, any> = { ...DEFAULT_SETTINGS }
    for (const setting of settings) {
      result[setting.key] = setting.value
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Drip] Settings update error:', error)
    return NextResponse.json({ error: '設定の更新に失敗しました' }, { status: 500 })
  }
}
