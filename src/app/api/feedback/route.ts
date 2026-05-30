export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/feedback
 * お問い合わせ・改善依頼（改善提案 / 機能要望 / エラー報告 / その他）を
 * 共通の Slack Webhook へ通知する。全サービス共通の窓口。
 * Body: { category | type, message, page, service, userAgent }
 */

// 種別ラベル（category 優先、旧 type も後方互換で受ける）
const CATEGORY_LABELS: Record<string, string> = {
  improvement: '✨ 改善したほうがいいこと',
  feature: '💡 追加の機能要望',
  bug: '🐛 エラー報告',
  error: '🚨 エラー報告', // 旧エラー画面（error.tsx）からの type:'error' 互換
  other: '📝 その他',
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email || '匿名ユーザー'
    const userName = session?.user?.name || '名前なし'

    const body = await req.json().catch(() => ({}))
    const {
      category,
      type,
      message,
      page = '',
      service = '',
      userAgent = '',
      // 旧エラー画面(error.tsx)からの後方互換フィールド
      error: errorText,
      description,
    } = body as {
      category?: string
      type?: string
      message?: string
      page?: string
      service?: string
      userAgent?: string
      error?: string
      description?: string
    }

    // 本文は message を優先。無ければ旧形式の description/error から組み立てる
    let finalMessage = (typeof message === 'string' ? message : '').trim()
    if (!finalMessage) {
      const parts: string[] = []
      if (typeof description === 'string' && description.trim()) parts.push(description.trim())
      if (typeof errorText === 'string' && errorText.trim()) parts.push(`エラー内容: ${errorText.trim()}`)
      finalMessage = parts.join('\n\n')
    }

    if (!finalMessage) {
      return NextResponse.json({ error: '内容を入力してください' }, { status: 400 })
    }
    if (finalMessage.length > 5000) {
      finalMessage = finalMessage.slice(0, 5000)
    }

    const key = category || type || 'other'
    const categoryLabel = CATEGORY_LABELS[key] || CATEGORY_LABELS.other

    // Slack Webhook URL を取得（共通: SystemSetting → 環境変数の順）
    let webhookUrl: string | null = null
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'slack_webhook' },
      })
      webhookUrl = (setting?.value as string) || null
    } catch {}
    if (!webhookUrl) {
      webhookUrl = process.env.SLACK_WEBHOOK_URL || null
    }

    const slackPayload = {
      text: `📣 お問い合わせ・改善依頼`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '📣 お問い合わせ・改善依頼', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*種別:*\n${categoryLabel}` },
            { type: 'mrkdwn', text: `*サービス:*\n${service || '不明'}` },
            { type: 'mrkdwn', text: `*ユーザー:*\n${userName}` },
            { type: 'mrkdwn', text: `*メール:*\n${userEmail}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*内容:*\n${finalMessage.slice(0, 2900)}` },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `ページ: ${page || 'N/A'}${userAgent ? ` ・ ${userAgent}` : ''}` },
          ],
        },
      ],
    }

    if (webhookUrl) {
      try {
        const r = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
        })
        if (!r.ok) console.error('[feedback] Slack送信失敗', r.status)
      } catch (e) {
        console.error('[feedback] Slack送信失敗', e)
      }
    } else {
      console.warn('[feedback] Slack webhook 未設定')
      console.log('[FEEDBACK]', { userName, userEmail, category: key, page, service, message: finalMessage })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[feedback] エラー', e)
    return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 })
  }
}
