export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function postToSlack(text: string) {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: 'slack_webhook' } })
    const url = row?.value
    if (!url) return
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch (e) {
    console.error('[feedback] Slack notification failed:', e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    const body = await req.json()
    const { service, type, page, error, description } = body

    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    const typeEmoji: Record<string, string> = {
      error: ':rotating_light:',
      bug: ':bug:',
      feature: ':bulb:',
      improvement: ':wrench:',
      other: ':speech_balloon:',
    }
    const typeLabel: Record<string, string> = {
      error: 'エラー報告',
      bug: 'バグ報告',
      feature: '機能リクエスト',
      improvement: '改善要望',
      other: 'その他',
    }

    const lines = [
      `<!channel>`,
      `${typeEmoji[type] || ':memo:'} *[${service || 'ドヤAI'} ${typeLabel[type] || type}]* ${now}`,
      user ? `- ユーザー: ${user.name || '不明'} (${user.email || '不明'})` : '- ユーザー: 未ログイン',
      page ? `- ページ: ${page}` : '',
      error ? `- エラー: ${error}` : '',
      description ? `- 詳細: ${description}` : '',
    ].filter(Boolean)

    await postToSlack(lines.join('\n'))

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[feedback] Error:', e)
    return NextResponse.json({ ok: false })
  }
}
