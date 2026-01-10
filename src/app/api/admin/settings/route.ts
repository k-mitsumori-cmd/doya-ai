import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

// cookies() を使用するため、静的最適化を無効化
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/settings - 設定を取得
export async function GET(request: NextRequest) {
  try {
    // 管理者認証チェック
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    // 設定を取得
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['gtm_id', 'ga_id', 'fb_pixel_id', 'hubspot_id', 'email_notifications', 'slack_webhook'],
        },
      },
    })

    const result: Record<string, string> = {}
    settings.forEach((s) => {
      result[s.key] = s.value
    })

    return NextResponse.json({
      gtmId: result.gtm_id || process.env.NEXT_PUBLIC_GTM_ID || '',
      gaId: result.ga_id || '',
      fbPixelId: result.fb_pixel_id || '',
      hubspotId: result.hubspot_id || '',
      emailNotifications: result.email_notifications === 'true',
      slackWebhook: result.slack_webhook || '',
    })
  } catch (e: any) {
    console.error('Get settings error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to get settings' }, { status: 500 })
  }
}

// POST /api/admin/settings - 設定を保存
export async function POST(request: NextRequest) {
  try {
    // 管理者認証チェック
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const { gtmId, gaId, fbPixelId, hubspotId, emailNotifications, slackWebhook } = body

    // 設定を保存（upsert）
    const updates = []
    if (gtmId !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: 'gtm_id' },
          create: { key: 'gtm_id', value: String(gtmId || '') },
          update: { value: String(gtmId || '') },
        })
      )
    }
    if (gaId !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: 'ga_id' },
          create: { key: 'ga_id', value: String(gaId || '') },
          update: { value: String(gaId || '') },
        })
      )
    }
    if (fbPixelId !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: 'fb_pixel_id' },
          create: { key: 'fb_pixel_id', value: String(fbPixelId || '') },
          update: { value: String(fbPixelId || '') },
        })
      )
    }
    if (hubspotId !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: 'hubspot_id' },
          create: { key: 'hubspot_id', value: String(hubspotId || '') },
          update: { value: String(hubspotId || '') },
        })
      )
    }
    if (emailNotifications !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: 'email_notifications' },
          create: { key: 'email_notifications', value: String(emailNotifications ? 'true' : 'false') },
          update: { value: String(emailNotifications ? 'true' : 'false') },
        })
      )
    }
    if (slackWebhook !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: 'slack_webhook' },
          create: { key: 'slack_webhook', value: String(slackWebhook || '') },
          update: { value: String(slackWebhook || '') },
        })
      )
    }

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Save settings error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to save settings' }, { status: 500 })
  }
}

