import { NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'
import { enrollUserInDripSequences } from '@/lib/drip-enroll'
import { fetchContactsCreatedAfter, hubspotConfigured } from '@/lib/hubspot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================
// HubSpot → ドリップ 自動同期エンジン
// 毎時実行: HubSpotの新規コンタクトを取得し、User作成＋ドリップ自動エンロール
// ============================================

const CRON_SECRET = process.env.CRON_SECRET
const CURSOR_KEY = 'hubspot_last_sync'
// 開始ステップ: 0=歓迎メールから / 1=歓迎スキップ（2通目から）。既定1（手動登録と揃える）
const START_STEP = Number(process.env.HUBSPOT_DRIP_START_STEP ?? '1')

export async function GET(request: Request) {
  // Cron認証（CRON_SECRET が設定されている場合のみ）
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!hubspotConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'HUBSPOT_PRIVATE_APP_TOKEN 未設定' })
  }

  const now = Date.now()

  // 同期カーソル取得。初回は「今」を保存し、過去の全コンタクトは取り込まない（一斉配信事故の防止）
  const cursorRow = await withRetry(() =>
    prisma.dripSetting.findUnique({ where: { key: CURSOR_KEY } })
  )
  if (!cursorRow) {
    await prisma.dripSetting.create({ data: { key: CURSOR_KEY, value: { ts: now } } })
    return NextResponse.json({
      initialized: true,
      cursor: now,
      note: '初回起動: 過去コンタクトは取り込まず、以降の新規のみ対象',
    })
  }
  const since = (cursorRow.value as { ts?: number })?.ts ?? now

  // 新規コンタクト取得
  let contacts
  try {
    contacts = await fetchContactsCreatedAfter(since)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    )
  }

  let created = 0
  let processed = 0
  let skippedNoEmail = 0
  let errors = 0
  let maxTs = since

  for (const c of contacts) {
    const ts = c.createdAt ? Date.parse(c.createdAt) : NaN
    if (Number.isFinite(ts) && ts > maxTs) maxTs = ts

    const email = c.email?.trim().toLowerCase()
    if (!email) {
      skippedNoEmail++
      continue
    }
    const name = [c.lastname, c.firstname].filter(Boolean).join(' ') || null

    try {
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
      const user =
        existing ??
        (await prisma.user.create({
          data: {
            email,
            name,
            signupService: 'hubspot',
            signupSource: 'HubSpot（自動同期）',
          },
          select: { id: true },
        }))
      if (!existing) created++

      // ドリップ自動エンロール（歓迎スキップ = startStep既定1）。既存エンロールは内部でスキップ
      await enrollUserInDripSequences(user.id, { startStep: START_STEP })
      processed++
    } catch (e) {
      errors++
      console.error('[hubspot-sync] contact failed:', email, e)
    }
  }

  // カーソル前進（処理した最大createdate。取得0件なら現在時刻へ）
  const newCursor = contacts.length ? maxTs : now
  await prisma.dripSetting.update({
    where: { key: CURSOR_KEY },
    data: { value: { ts: newCursor } },
  })

  return NextResponse.json({
    fetched: contacts.length,
    created,
    processed,
    skippedNoEmail,
    errors,
    cursor: newCursor,
  })
}
