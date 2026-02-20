import { prisma } from './prisma'

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
    const slackWebhook = await prisma.systemSetting.findUnique({
      where: { key: 'slack_webhook' },
    })

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
  const row = await prisma.systemSetting.findUnique({
    where: { key: 'slack_webhook' },
  })
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
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // 過去24時間の新規ユーザー（名前付き）
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
  const lastMonth1st = getJSTStartOfMonth(new Date(thisMonth1st.getTime() - 1))

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
/** 指定日時のJSTでの週の月曜日 0:00 をUTCのDateで返す */
function getJSTStartOfWeek(date: Date): Date {
  // JST = UTC + 9
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const day = jst.getUTCDay() // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1 // 月曜からの差分
  jst.setUTCHours(0, 0, 0, 0)
  jst.setUTCDate(jst.getUTCDate() - diff)
  // UTCに戻す
  return new Date(jst.getTime() - 9 * 60 * 60 * 1000)
}

/** 指定日時のJSTでの月初 1日 0:00 をUTCのDateで返す */
function getJSTStartOfMonth(date: Date): Date {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  jst.setUTCDate(1)
  jst.setUTCHours(0, 0, 0, 0)
  return new Date(jst.getTime() - 9 * 60 * 60 * 1000)
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

