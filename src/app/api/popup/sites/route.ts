export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPopupUserId } from '@/lib/popup/access'
import { proposeForUser } from '@/lib/popup/propose'
import { listSites } from '@/lib/popup/popup-read'

/**
 * 提案の作成: URL（と、読み取れないサイト向けの手入力説明）→ 読み取り → 質問リンク → 2〜3案を下書きで作る。
 * 処理の正本は src/lib/popup/propose.ts（エージェントの道具 popup.proposeDrafts と同じ関数）。
 */
export async function POST(req: NextRequest) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const r = await proposeForUser(userId, { url: body?.url, manualText: body?.manualText })
  if (r.ok) return NextResponse.json({ site: r.site, popups: r.popups })
  if (r.status === 429) {
    return NextResponse.json(
      { error: r.error, limitReached: true, used: r.quota.used, limit: r.quota.limit, upgradeUrl: '/popup/pricing' },
      { status: 429 }
    )
  }
  if (r.status === 422) return NextResponse.json({ error: r.error, code: r.code, canUseManualInput: true }, { status: 422 })
  return NextResponse.json({ error: r.error }, { status: r.status })
}

/** サイト一覧（自分の分だけ）と直近30日の集計。正本は popup-read.ts */
export async function GET() {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  return NextResponse.json({ sites: await listSites(prisma, userId) })
}
