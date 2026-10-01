import { NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/prisma'
import { enrollUserInDripSequences } from '@/lib/drip-enroll'
import { fetchContactsCreatedAfter, hubspotConfigured } from '@/lib/hubspot'
import { sendHubspotSyncNotification } from '@/lib/notifications'

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
  // ------------------------------------------------------------------
  // Cron認証
  // ------------------------------------------------------------------
  // ⚠️ 「CRON_SECRET が設定されている場合のみ検証する」にしないこと。
  //    env の設定漏れや削除事故の瞬間に、このルートが誰でも叩ける状態になる。
  //    このルートはメール実送信・外部同期・DB書き込みという副作用を持つため、
  //    未設定なら**動かさない**（他の cron ルートも fail-closed で揃えてある）。
  const authHeader = request.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  const since = (cursorRow.value as { ts?: number } | null)?.ts
  if (typeof since !== 'number' || !Number.isSafeInteger(since) || since < 0 || since > now) {
    console.error('[hubspot-sync] invalid saved cursor')
    return NextResponse.json({ error: '同期位置を確認できませんでした' }, { status: 503 })
  }

  // 新規コンタクト取得
  let contacts
  try {
    // 同じ作成時刻の別コンタクトを取りこぼさないよう、前回境界を1ms重ねる。
    // 既存ユーザー・エンロールメントは再実行しても重複作成しない。
    contacts = await fetchContactsCreatedAfter(Math.max(0, since - 1))
  } catch (e) {
    console.error('[hubspot-sync] contact fetch failed:')
    return NextResponse.json(
      { error: 'HubSpotのコンタクトを取得できませんでした' },
      { status: 502 }
    )
  }

  let created = 0
  let processed = 0
  let skippedNoEmail = 0
  let errors = 0
  let maxTs = since
  // 実際に配信リストへ新規追加できたリード（Slack通知用）
  const addedLeads: Array<{ name: string | null; email: string }> = []

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
      const enrolledCount = await enrollUserInDripSequences(user.id, { startStep: START_STEP })
      if (enrolledCount > 0) addedLeads.push({ name, email })
      processed++
    } catch (e) {
      errors++
      console.error('[hubspot-sync] contact failed:')
    }
  }

  // 一件でも失敗した場合、次回の再試行のためカーソルを進めない。
  const retryPending = errors > 0
  const newCursor = retryPending ? since : maxTs > since ? maxTs : now
  if (!retryPending) {
    await prisma.dripSetting.update({
      where: { key: CURSOR_KEY },
      data: { value: { ts: newCursor } },
    })
  }

  // 実際に配信リストへ追加できたリードがあればSlack通知（mail01_メール配信通知）
  if (addedLeads.length > 0) {
    await sendHubspotSyncNotification(addedLeads)
  }

  return NextResponse.json({
    fetched: contacts.length,
    created,
    processed,
    added: addedLeads.length,
    skippedNoEmail,
    errors,
    cursor: newCursor,
    retryPending,
  }, { status: retryPending ? 503 : 200 })
}
