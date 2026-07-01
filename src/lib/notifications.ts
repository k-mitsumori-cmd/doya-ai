import { prisma, withRetry } from './prisma'
import { fetchGCPUsageReport } from './gcp-usage'

export type ErrorNotificationData = {
  errorMessage: string
  errorStack?: string
  pathname?: string
  userId?: string
  userEmail?: string | null
  userName?: string | null
  errorDigest?: string
  userAgent?: string
  timestamp: string
  httpStatus?: number
  requestMethod?: string
  requestUrl?: string
  requestBody?: string
}

/**
 * APIエラー通知（Slack等）を送信する
 * - 設定は `SystemSetting` の `slack_webhook` を参照
 * - 設定が無い場合はno-op
 */
export async function sendErrorNotification(data: ErrorNotificationData): Promise<void> {
  try {
    const slackWebhook = await withRetry(() => prisma.systemSetting.findUnique({
      where: { key: 'slack_webhook' },
    }))

    const webhookUrl = slackWebhook?.value || ''
    if (!webhookUrl) {
      // 設定が無ければ静かにスキップ
      return
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: formatErrorMessage(data),
      }),
    })
  } catch (e) {
    // 通知の失敗で処理自体を止めない
    console.error('[Notification] Failed to sendErrorNotification:', e)
  }
}

function formatErrorMessage(data: ErrorNotificationData): string {
  const lines: string[] = []
  lines.push(`*[API Error]* ${data.timestamp}`)
  if (data.pathname) lines.push(`- path: ${data.pathname}`)
  if (data.httpStatus) lines.push(`- status: ${data.httpStatus}`)
  if (data.requestMethod) lines.push(`- method: ${data.requestMethod}`)
  if (data.requestUrl) lines.push(`- url: ${data.requestUrl}`)
  if (data.userId || data.userEmail) lines.push(`- user: ${data.userId || ''} ${data.userEmail || ''}`.trim())
  lines.push('')
  lines.push(`*message*`)
  lines.push(truncate(data.errorMessage, 1800))
  if (data.requestBody) {
    lines.push('')
    lines.push(`*requestBody*`)
    lines.push(truncate(data.requestBody, 1200))
  }
  if (data.errorStack) {
    lines.push('')
    lines.push(`*stack*`)
    lines.push(truncate(data.errorStack, 1800))
  }
  return lines.join('\n')
}

function truncate(s: string, max: number): string {
  const str = String(s || '')
  return str.length > max ? `${str.slice(0, max)}…` : str
}

// ========================================
// Webhook URL 取得（共通）
// ========================================
async function getSlackWebhookUrl(): Promise<string> {
  const row = await withRetry(() => prisma.systemSetting.findUnique({
    where: { key: 'slack_webhook' },
  }))
  return row?.value || ''
}

async function postToSlack(text: string): Promise<void> {
  const url = await getSlackWebhookUrl()
  if (!url) {
    throw new Error('Slack webhook URL is not configured (slack_webhook not found in SystemSetting)')
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Slack webhook returned ${res.status}: ${body}`)
  }
}

// ========================================
// イベント通知（ログイン・課金・解約等）
// ========================================
type EventType = 'signup' | 'login' | 'subscription' | 'cancellation' | 'payment_failed'

const EVENT_EMOJI: Record<EventType, string> = {
  signup: ':tada:',
  login: ':door:',
  subscription: ':credit_card:',
  cancellation: ':wave:',
  payment_failed: ':warning:',
}

const EVENT_LABEL: Record<EventType, string> = {
  signup: '新規登録',
  login: 'ログイン',
  subscription: '課金',
  cancellation: '解約',
  payment_failed: '支払い失敗',
}

export async function sendEventNotification(event: {
  type: EventType
  userEmail?: string | null
  userName?: string | null
  details?: string
}): Promise<void> {
  try {
    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    const emoji = EVENT_EMOJI[event.type]
    const label = EVENT_LABEL[event.type]
    const who = event.userName || event.userEmail || '不明'

    const lines = [
      `<!channel>`,
      `${emoji} *[${label}]* ${now}`,
      `- ユーザー: ${who}${event.userEmail ? ` (${event.userEmail})` : ''}`,
    ]
    if (event.details) lines.push(`- ${event.details}`)

    await postToSlack(lines.join('\n'))
  } catch (e) {
    console.error('[Notification] Failed to sendEventNotification:', e)
  }
}

// ========================================
// 日次サマリー通知（毎朝9時に送信）
// ========================================
export async function sendDailySummary(): Promise<void> {
  const now = new Date()
  // JST の「今日 0:00」と「昨日 0:00」を基準にする（UTC+9 ベース）
  const todayJST = getJSTStartOfDay(now)
  const yesterday = new Date(todayJST.getTime() - 24 * 60 * 60 * 1000)

  // JST昨日0:00〜今日0:00 の新規ユーザー（名前付き）
  const newUsersList = await prisma.user.findMany({
    where: { createdAt: { gte: yesterday } },
    select: { name: true, email: true },
    orderBy: { createdAt: 'desc' },
  })
  const newUsers = newUsersList.length

  // 総ユーザー数
  const totalUsers = await prisma.user.count()

  // 過去24時間の生成数（Generation テーブル）
  const newGenerations = await prisma.generation.count({
    where: { createdAt: { gte: yesterday } },
  })

  // サービス別の生成数
  const generationsByService = await prisma.generation.groupBy({
    by: ['serviceId'],
    where: { createdAt: { gte: yesterday } },
    _count: { _all: true },
  })

  // 生成数トップ3ユーザー（過去24時間）
  const topGeneratorsAll = await prisma.generation.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: yesterday } },
    _count: { _all: true },
  })
  const topGenerators = topGeneratorsAll
    .sort((a, b) => ((b._count as any)?._all ?? 0) - ((a._count as any)?._all ?? 0))
    .slice(0, 3)
  const topUserIds = topGenerators.map(g => g.userId)
  const topUsers = topUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: topUserIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const topUserMap = new Map(topUsers.map(u => [u.id, u]))

  // 有料ユーザー（名前付き）
  const paidUsersList = await prisma.user.findMany({
    where: { plan: { not: 'FREE' } },
    select: { name: true, email: true, plan: true },
    orderBy: { createdAt: 'desc' },
  })
  const paidUsers = paidUsersList.length

  // 所感メッセージを生成
  const greeting = getDailyGreeting(newUsers, newGenerations, paidUsers)

  // フォーマット
  const dateStr = now.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
  const serviceLines = generationsByService
    .sort((a, b) => (b._count?._all ?? 0) - (a._count?._all ?? 0))
    .map((s) => `  - ${s.serviceId}: ${s._count?._all ?? 0}件`)

  const lines = [
    `<!channel>`,
    `📊 *[日次レポート]* ${dateStr}`,
    ``,
    greeting,
    ``,
    `*👥 ユーザー*`,
    `- 新規登録: ${newUsers}人`,
    ...(newUsersList.length > 0
      ? newUsersList.map((u) => `  - ${u.name || '名前未設定'} (${u.email})`)
      : []),
    `- 総ユーザー数: ${totalUsers}人`,
    `- 有料ユーザー: ${paidUsers}人`,
    ...(paidUsersList.length > 0
      ? paidUsersList.map((u) => `  - ${u.name || '名前未設定'} (${u.email}) [${u.plan}]`)
      : []),
    ``,
    `*⚡ 生成数（過去24時間）*`,
    `- 合計: ${newGenerations}件`,
    ...(serviceLines.length > 0 ? serviceLines : ['  - (なし)']),
    ``,
    `*🏆 生成数トップ3*`,
    ...(topGenerators.length > 0
      ? topGenerators.map((g, i) => {
          const u = topUserMap.get(g.userId)
          const name = u?.name || u?.email || '不明'
          return `  ${i + 1}. ${name}：${(g._count as any)?._all ?? 0}枚`
        })
      : ['  - (生成なし)']),
  ]

  await postToSlack(lines.join('\n'))
}

// ========================================
// 週次サマリー通知（毎週月曜 朝9時に送信）
// ========================================
export async function sendWeeklySummary(): Promise<void> {
  const now = new Date()
  // 先週の月曜 0:00 JST ～ 今週月曜 0:00 JST
  const thisMonday = getJSTStartOfWeek(now)
  const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000)

  // --- 先週の数値 ---
  const weekNewUsers = await prisma.user.findMany({
    where: { createdAt: { gte: lastMonday, lt: thisMonday } },
    select: { name: true, email: true },
    orderBy: { createdAt: 'desc' },
  })
  const weekGenerations = await prisma.generation.count({
    where: { createdAt: { gte: lastMonday, lt: thisMonday } },
  })
  const weekGenByService = await prisma.generation.groupBy({
    by: ['serviceId'],
    where: { createdAt: { gte: lastMonday, lt: thisMonday } },
    _count: { _all: true },
  })

  // 生成数トップ3ユーザー（先週）
  const weekTopGeneratorsAll = await prisma.generation.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: lastMonday, lt: thisMonday } },
    _count: { _all: true },
  })
  const weekTopGenerators = weekTopGeneratorsAll
    .sort((a, b) => ((b._count as any)?._all ?? 0) - ((a._count as any)?._all ?? 0))
    .slice(0, 3)
  const weekTopUserIds = weekTopGenerators.map(g => g.userId)
  const weekTopUsers = weekTopUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: weekTopUserIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const weekTopUserMap = new Map(weekTopUsers.map(u => [u.id, u]))

  // --- 累計 ---
  const totalUsers = await prisma.user.count()
  const totalGenerations = await prisma.generation.count()
  const paidUsersList = await prisma.user.findMany({
    where: { plan: { not: 'FREE' } },
    select: { name: true, email: true, plan: true },
    orderBy: { createdAt: 'desc' },
  })

  const weekStr = `${formatJSTDate(lastMonday)} 〜 ${formatJSTDate(new Date(thisMonday.getTime() - 1))}`
  const serviceLines = weekGenByService
    .sort((a, b) => (b._count?._all ?? 0) - (a._count?._all ?? 0))
    .map((s) => `  - ${s.serviceId}: ${s._count?._all ?? 0}件`)

  const greeting = getWeeklyGreeting(weekNewUsers.length, weekGenerations, paidUsersList.length)

  const lines = [
    `<!channel>`,
    `📅 *[週次レポート]* ${weekStr}`,
    ``,
    greeting,
    ``,
    `*--- 先週の結果 ---*`,
    ``,
    `*👥 新規ユーザー: ${weekNewUsers.length}人*`,
    ...(weekNewUsers.length > 0
      ? weekNewUsers.map((u) => `  - ${u.name || '名前未設定'} (${u.email})`)
      : []),
    ``,
    `*⚡ 生成数: ${weekGenerations}件*`,
    ...(serviceLines.length > 0 ? serviceLines : ['  - (なし)']),
    ``,
    `*🏆 生成数トップ3*`,
    ...(weekTopGenerators.length > 0
      ? weekTopGenerators.map((g, i) => {
          const u = weekTopUserMap.get(g.userId)
          const name = u?.name || u?.email || '不明'
          return `  ${i + 1}. ${name}：${(g._count as any)?._all ?? 0}枚`
        })
      : ['  - (生成なし)']),
    ``,
    `*--- 累計 ---*`,
    `- 総ユーザー数: ${totalUsers}人`,
    `- 有料ユーザー: ${paidUsersList.length}人`,
    ...(paidUsersList.length > 0
      ? paidUsersList.map((u) => `  - ${u.name || '名前未設定'} (${u.email}) [${u.plan}]`)
      : []),
    `- 総生成数: ${totalGenerations}件`,
  ]

  await postToSlack(lines.join('\n'))
}

// ========================================
// 月次サマリー通知（毎月1日 朝9時に送信）
// ========================================
export async function sendMonthlySummary(): Promise<void> {
  const now = new Date()
  // 先月1日 0:00 JST ～ 今月1日 0:00 JST
  const thisMonth1st = getJSTStartOfMonth(now)
  const lastMonth1st = getJSTStartOfMonth(new Date(thisMonth1st.getTime() - 24 * 60 * 60 * 1000))

  // --- 先月の数値 ---
  const monthNewUsers = await prisma.user.findMany({
    where: { createdAt: { gte: lastMonth1st, lt: thisMonth1st } },
    select: { name: true, email: true },
    orderBy: { createdAt: 'desc' },
  })
  const monthGenerations = await prisma.generation.count({
    where: { createdAt: { gte: lastMonth1st, lt: thisMonth1st } },
  })
  const monthGenByService = await prisma.generation.groupBy({
    by: ['serviceId'],
    where: { createdAt: { gte: lastMonth1st, lt: thisMonth1st } },
    _count: { _all: true },
  })

  // 生成数トップ3ユーザー（先月）
  const monthTopGeneratorsAll = await prisma.generation.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: lastMonth1st, lt: thisMonth1st } },
    _count: { _all: true },
  })
  const monthTopGenerators = monthTopGeneratorsAll
    .sort((a, b) => ((b._count as any)?._all ?? 0) - ((a._count as any)?._all ?? 0))
    .slice(0, 3)
  const monthTopUserIds = monthTopGenerators.map(g => g.userId)
  const monthTopUsers = monthTopUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: monthTopUserIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const monthTopUserMap = new Map(monthTopUsers.map(u => [u.id, u]))

  // --- 累計 ---
  const totalUsers = await prisma.user.count()
  const totalGenerations = await prisma.generation.count()
  const paidUsersList = await prisma.user.findMany({
    where: { plan: { not: 'FREE' } },
    select: { name: true, email: true, plan: true },
    orderBy: { createdAt: 'desc' },
  })

  // 先月の名前
  const lastMonthName = lastMonth1st.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
  })
  const serviceLines = monthGenByService
    .sort((a, b) => (b._count?._all ?? 0) - (a._count?._all ?? 0))
    .map((s) => `  - ${s.serviceId}: ${s._count?._all ?? 0}件`)

  const greeting = getMonthlyGreeting(monthNewUsers.length, monthGenerations, paidUsersList.length)

  const lines = [
    `<!channel>`,
    `📆 *[月次レポート]* ${lastMonthName}`,
    ``,
    greeting,
    ``,
    `*--- 先月の結果 ---*`,
    ``,
    `*👥 新規ユーザー: ${monthNewUsers.length}人*`,
    ...(monthNewUsers.length > 0
      ? monthNewUsers.map((u) => `  - ${u.name || '名前未設定'} (${u.email})`)
      : []),
    ``,
    `*⚡ 生成数: ${monthGenerations}件*`,
    ...(serviceLines.length > 0 ? serviceLines : ['  - (なし)']),
    ``,
    `*🏆 生成数トップ3*`,
    ...(monthTopGenerators.length > 0
      ? monthTopGenerators.map((g, i) => {
          const u = monthTopUserMap.get(g.userId)
          const name = u?.name || u?.email || '不明'
          return `  ${i + 1}. ${name}：${(g._count as any)?._all ?? 0}枚`
        })
      : ['  - (生成なし)']),
    ``,
    `*--- 累計 ---*`,
    `- 総ユーザー数: ${totalUsers}人`,
    `- 有料ユーザー: ${paidUsersList.length}人`,
    ...(paidUsersList.length > 0
      ? paidUsersList.map((u) => `  - ${u.name || '名前未設定'} (${u.email}) [${u.plan}]`)
      : []),
    `- 総生成数: ${totalGenerations}件`,
  ]

  await postToSlack(lines.join('\n'))
}

// ========================================
// 日付ユーティリティ（JST基準）
// ========================================
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/** JST の年月日時分秒を安全に取得するヘルパー */
function getJSTParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(p => [p.type, p.value])
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday, // Mon, Tue, ...
    hour: Number(parts.hour),
  }
}

/** 指定日時のJSTでの当日 0:00 をUTC Dateで返す */
function getJSTStartOfDay(date: Date): Date {
  const p = getJSTParts(date)
  // JST 0:00 = UTC の前日 15:00
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - JST_OFFSET_MS)
}

/** 指定日時のJSTでの週の月曜日 0:00 をUTCのDateで返す */
function getJSTStartOfWeek(date: Date): Date {
  const p = getJSTParts(date)
  // 曜日から月曜までの差分を計算
  const dayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  const diff = dayMap[p.weekday] ?? 0
  const mondayUTC = Date.UTC(p.year, p.month - 1, p.day - diff)
  return new Date(mondayUTC - JST_OFFSET_MS)
}

/** 指定日時のJSTでの月初 1日 0:00 をUTCのDateで返す */
function getJSTStartOfMonth(date: Date): Date {
  const p = getJSTParts(date)
  return new Date(Date.UTC(p.year, p.month - 1, 1) - JST_OFFSET_MS)
}

/** DateをJST日付文字列で返す (例: 2/13) */
function formatJSTDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' })
}

// ========================================
// 所感メッセージ
// ========================================
// 数値に応じた明るい所感メッセージ
function getDailyGreeting(newUsers: number, generations: number, paidUsers: number): string {
  const greetings = [
    'おはようございます！今日も一日がんばりましょう 💪',
    'おはようございます！昨日の成果をチェックしましょう ☀️',
    'おはようございます！新しい一日のスタートです 🌅',
  ]
  const base = greetings[Math.floor(Math.random() * greetings.length)]

  const highlights: string[] = []
  if (newUsers >= 10) highlights.push(`🎉 新規ユーザー ${newUsers}人！すごい伸びです！`)
  else if (newUsers >= 5) highlights.push(`✨ 新規ユーザー ${newUsers}人、いい調子です！`)
  else if (newUsers >= 1) highlights.push(`👋 新しい仲間が ${newUsers}人増えました！`)

  if (generations >= 100) highlights.push(`🔥 生成数 ${generations}件！大活躍の一日でした！`)
  else if (generations >= 30) highlights.push(`⚡ ${generations}件の生成、たくさん使われています！`)
  else if (generations >= 1) highlights.push(`🚀 ${generations}件生成されました、着実に成長中！`)

  if (paidUsers >= 1) highlights.push(`💎 有料ユーザー ${paidUsers}人、ありがたいですね！`)

  return highlights.length > 0
    ? `${base}\n${highlights.join('\n')}`
    : base
}

function getWeeklyGreeting(newUsers: number, generations: number, paidUsers: number): string {
  const greetings = [
    '今週もお疲れさまでした！先週の振り返りです 📋',
    '新しい一週間のスタート！先週を振り返りましょう 🗓️',
    '月曜日です！先週の成果をチェックしましょう 📊',
  ]
  const base = greetings[Math.floor(Math.random() * greetings.length)]

  const highlights: string[] = []
  if (newUsers >= 20) highlights.push(`🎊 先週は ${newUsers}人が新規登録！大躍進の一週間でした！`)
  else if (newUsers >= 10) highlights.push(`🎉 先週 ${newUsers}人の新規登録、素晴らしい成長です！`)
  else if (newUsers >= 1) highlights.push(`👋 先週 ${newUsers}人の新しい仲間が加わりました！`)

  if (generations >= 500) highlights.push(`🔥 ${generations}件の生成！すごい活用度です！`)
  else if (generations >= 100) highlights.push(`⚡ ${generations}件の生成、活発に利用されています！`)
  else if (generations >= 1) highlights.push(`🚀 ${generations}件生成、着実に伸びています！`)

  if (paidUsers >= 1) highlights.push(`💎 有料ユーザー ${paidUsers}人、頼もしいですね！`)

  return highlights.length > 0
    ? `${base}\n${highlights.join('\n')}`
    : base
}

function getMonthlyGreeting(newUsers: number, generations: number, paidUsers: number): string {
  const greetings = [
    '新しい月のスタートです！先月を振り返りましょう 🌸',
    '月初のご報告です！先月の成果をまとめました 📈',
    'お疲れさまでした！先月の実績レポートです 🏆',
  ]
  const base = greetings[Math.floor(Math.random() * greetings.length)]

  const highlights: string[] = []
  if (newUsers >= 50) highlights.push(`🏅 先月は ${newUsers}人が新規登録！過去最高かも？！`)
  else if (newUsers >= 20) highlights.push(`🎊 先月 ${newUsers}人の新規登録、好調です！`)
  else if (newUsers >= 1) highlights.push(`👥 先月 ${newUsers}人の新しい仲間が加わりました！`)

  if (generations >= 2000) highlights.push(`🔥 ${generations}件の生成！圧倒的な活用度です！`)
  else if (generations >= 500) highlights.push(`⚡ ${generations}件の生成、しっかり使われています！`)
  else if (generations >= 1) highlights.push(`🚀 ${generations}件生成、来月も楽しみです！`)

  if (paidUsers >= 5) highlights.push(`💎 有料ユーザー ${paidUsers}人！ビジネスが育っています！`)
  else if (paidUsers >= 1) highlights.push(`💎 有料ユーザー ${paidUsers}人、ありがたいですね！`)

  return highlights.length > 0
    ? `${base}\n${highlights.join('\n')}`
    : base
}

// ========================================
// ドリップ（Resend）配信レポート通知（朝/夜の1日2回）
// ========================================

/**
 * ドリップ配信レポート専用のSlack Webhook URLを取得
 * - 優先: 環境変数 `SLACK_DRIP_WEBHOOK_URL`（メール配信レポート専用チャンネル）
 * - フォールバック: 既存の SystemSetting `slack_webhook`
 */
async function getDripSlackWebhookUrl(): Promise<string> {
  const fromEnv = process.env.SLACK_DRIP_WEBHOOK_URL
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  return getSlackWebhookUrl()
}

async function postDripToSlack(text: string): Promise<void> {
  const url = await getDripSlackWebhookUrl()
  if (!url) {
    throw new Error('Drip Slack webhook URL is not configured (SLACK_DRIP_WEBHOOK_URL / slack_webhook)')
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Slack webhook returned ${res.status}: ${body}`)
  }
}

interface DripDayStats {
  total: number      // その日のログ総数（sent + failed）
  sent: number       // 実際に配信できた件数（failed を除く）
  failed: number     // 送信失敗件数
  opened: number
  clicked: number
  bounced: number
  openRate: number   // 開封率(%) = opened / delivered（delivered = sent − bounced）
  clickRate: number  // クリック率(%) = clicked / delivered
  bounceRate: number // バウンス率(%) = bounced / delivered
}

/** 指定期間[start, end) に送信されたドリップメールのスタッツを集計 */
async function computeDripDayStats(start: Date, end: Date): Promise<DripDayStats> {
  const logs = await withRetry(() => prisma.dripEmailLog.findMany({
    where: { sentAt: { gte: start, lt: end } },
    select: { status: true, openedAt: true, clickedAt: true, bouncedAt: true },
  }))
  const failed = logs.filter(l => l.status === 'failed').length
  const sent = logs.length - failed
  const opened = logs.filter(l => l.openedAt !== null).length
  const clicked = logs.filter(l => l.clickedAt !== null).length
  const bounced = logs.filter(l => l.bouncedAt !== null).length
  // 開封率・クリック率の分母は「到達数（送信 − バウンス）」で算出する
  const delivered = Math.max(0, sent - bounced)
  const rate = (n: number) => (delivered > 0 ? Math.round((n / delivered) * 1000) / 10 : 0)
  return {
    total: logs.length,
    sent,
    failed,
    opened,
    clicked,
    bounced,
    openRate: rate(opened),
    clickRate: rate(clicked),
    bounceRate: rate(bounced),
  }
}

/**
 * 期間[start, end) に配信予定のドリップメール件数を算出
 *   配信予定件数 = 「本日すでに配信済み」＋「本日まだ配信待ち」
 *
 * drip-sender は送信成功のたびに enrollment.currentStep を進めるため、
 * currentStep だけを見ると「本日すでに送った分」が予定件数から抜け落ちて
 * 夜レポートで『予定0件・実績10件』のような矛盾が起きる。これを避けるため
 * 送信済みログ数を加算し、未送信分は currentStep の予定日で判定する。
 *
 * - 配信待ち = 予定日(enrolledAt + dayOffset)が end 到達までに来ているアクティブ
 *   エンロール（過去日到達＝繰り越しバックログも drip-sender は当日送るので含める）
 * - 配信停止 / 非アクティブなシーケンス / テンプレート未設定 / email 無しは除外
 * ※ 条件分岐(conditionType)や送信ウィンドウ跨ぎの1日ズレは考慮しない概算値
 */
async function computeDripScheduledForDay(start: Date, end: Date): Promise<number> {
  const unsub = await withRetry(() => prisma.dripUnsubscribe.findMany({ select: { userId: true } }))
  const unsubIds = new Set(unsub.map(u => u.userId))

  // 本日すでに配信されたメール（失敗を除く）。currentStep が進んでいるため別途集計する
  const alreadySent = await withRetry(() => prisma.dripEmailLog.count({
    where: { sentAt: { gte: start, lt: end }, status: { not: 'failed' } },
  }))

  // 本日まだ配信待ちのメール（次ステップの予定日が end までに到達済み・未送信）
  const enrollments = await withRetry(() => prisma.dripEnrollment.findMany({
    where: { status: 'active' },
    select: {
      userId: true,
      currentStep: true,
      enrolledAt: true,
      user: { select: { email: true } },
      sequence: {
        select: {
          status: true,
          steps: {
            orderBy: { sortOrder: 'asc' },
            select: { dayOffset: true, templateId: true },
          },
        },
      },
    },
  }))

  let pending = 0
  for (const e of enrollments) {
    if (unsubIds.has(e.userId)) continue
    if (!e.user?.email) continue
    if (e.sequence.status !== 'active') continue
    const step = e.sequence.steps[e.currentStep]
    if (!step || !step.templateId) continue
    // 配信予定日 = enrolledAt + dayOffset 日（drip-sender と同一の算出方法）
    const target = new Date(e.enrolledAt)
    target.setDate(target.getDate() + step.dayOffset)
    // 予定日が end までに到達していれば本日配信対象（当日到達 + 過去日の繰り越し）
    if (target < end) pending++
  }
  return alreadySent + pending
}

/**
 * ドリップ配信レポートをSlackに送信する（朝/夜の2回）
 * - 本日の配信予定件数
 * - 本日の実際の配信件数
 * - 本日の開封率・クリック率などのスタッツ
 * - 昨日の最終実績
 */
export async function sendDripReport(slot: 'morning' | 'evening'): Promise<void> {
  const now = new Date()
  const todayStart = getJSTStartOfDay(now)
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

  const [scheduledToday, todayStats, yStats] = await Promise.all([
    computeDripScheduledForDay(todayStart, todayEnd),
    computeDripDayStats(todayStart, todayEnd),
    computeDripDayStats(yesterdayStart, todayStart),
  ])

  const dateStr = now.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
  const isMorning = slot === 'morning'
  const header = isMorning
    ? `☀️ *[ドリップ配信レポート・朝]* ${dateStr}`
    : `🌙 *[ドリップ配信レポート・夜]* ${dateStr}`
  const greeting = isMorning
    ? 'おはようございます！本日のメール配信予定と昨日の結果です 📬'
    : 'お疲れさまでした！本日のメール配信実績のまとめです 📊'
  const actualLabel = isMorning ? '現時点' : '本日分'

  const lines: string[] = [
    header,
    ``,
    greeting,
    ``,
    `*📮 本日の配信予定*`,
    `- 配信予定件数: ${scheduledToday}件`,
    ``,
    `*📤 本日の配信実績（${actualLabel}）*`,
    `- 配信済み: ${todayStats.sent}件${todayStats.failed > 0 ? ` / 失敗: ${todayStats.failed}件` : ''}`,
    `- 開封: ${todayStats.opened}件（開封率 ${todayStats.openRate}%）`,
    `- クリック: ${todayStats.clicked}件（クリック率 ${todayStats.clickRate}%）`,
    ...(todayStats.bounced > 0
      ? [`- バウンス: ${todayStats.bounced}件（${todayStats.bounceRate}%）`]
      : []),
    ``,
    `*📈 昨日の最終実績*`,
    `- 配信: ${yStats.sent}件${yStats.failed > 0 ? ` / 失敗: ${yStats.failed}件` : ''}`,
    `- 開封率: ${yStats.openRate}%（${yStats.opened}件）`,
    `- クリック率: ${yStats.clickRate}%（${yStats.clicked}件）`,
    ...(yStats.bounced > 0 ? [`- バウンス率: ${yStats.bounceRate}%（${yStats.bounced}件）`] : []),
  ]

  await postDripToSlack(lines.join('\n'))
}

// ========================================
// GCP使用量レポート通知（毎日Slackに通知）
// ========================================
export async function sendGCPUsageReport(): Promise<void> {
  const report = await fetchGCPUsageReport()
  const dateStr = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })

  const lines: string[] = [
    `☁️ *[GCP日次使用量レポート]* ${dateStr}`,
    ``,
  ]

  if (report.error) {
    lines.push(`⚠️ データ取得エラー: ${report.error}`)
    lines.push(``)
  }

  // Gemini API セクション
  lines.push(`*🤖 Gemini API（過去24時間）*`)
  if (report.geminiApi.totalRequests > 0) {
    lines.push(`- リクエスト数: ${report.geminiApi.totalRequests.toLocaleString()}件`)
    for (const m of report.geminiApi.requestsByMethod) {
      lines.push(`  - ${m.method}: ${m.count.toLocaleString()}件`)
    }
    if (report.geminiApi.errorCount > 0) {
      lines.push(`- エラー数: ${report.geminiApi.errorCount.toLocaleString()}件（エラー率: ${report.geminiApi.errorRate.toFixed(1)}%）`)
    } else {
      lines.push(`- エラー: なし ✅`)
    }
  } else if (!report.error) {
    lines.push(`- リクエスト数: 0件`)
  }

  // コスト推定セクション（日次）
  lines.push(``)
  lines.push(`*💰 推定コスト（過去24時間）*`)
  if (report.estimatedCost.totalJpy > 0) {
    lines.push(`- Gemini API: *¥${report.estimatedCost.geminiApiJpy.toLocaleString()}*（$${report.estimatedCost.geminiApiUsd.toFixed(2)}）`)
  } else {
    lines.push(`- ¥0`)
  }

  // 月間累計セクション
  const monthLabel = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long' })
  lines.push(``)
  lines.push(`*📅 月間累計（${monthLabel}）*`)
  lines.push(`- リクエスト数: ${report.monthly.totalRequests.toLocaleString()}件`)
  if (report.monthly.estimatedCost.totalJpy > 0) {
    lines.push(`- 推定コスト: *¥${report.monthly.estimatedCost.totalJpy.toLocaleString()}*（$${report.monthly.estimatedCost.totalUsd.toFixed(2)}）`)
  } else {
    lines.push(`- 推定コスト: ¥0`)
  }
  lines.push(`_※ Gemini 2.0 Flash基準の推定値_`)

  // 他のAPIサービス セクション
  if (report.otherApis.length > 0) {
    lines.push(``)
    lines.push(`*🔧 その他のAPIサービス*`)
    for (const api of report.otherApis.slice(0, 10)) {
      const shortName = api.service.replace('.googleapis.com', '')
      lines.push(`- ${shortName}: ${api.count.toLocaleString()}件`)
    }
  }

  // プロジェクト情報
  lines.push(``)
  lines.push(`_Project: ${report.projectId}_`)

  await postToSlack(lines.join('\n'))
}

