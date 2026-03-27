import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { generateUnsubscribeToken } from '@/app/api/drip/unsubscribe/route'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Vercel Cron認証（任意）
const CRON_SECRET = process.env.CRON_SECRET

// ============================================
// ドリップ配信エンジン
// 毎時実行: 配信対象のステップを評価し、メールを送信する
// ============================================

export async function GET(request: Request) {
  // Cron認証（CRON_SECRET が設定されている場合のみ）
  if (CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  const currentHour = now.getUTCHours() + 9 // JST (UTC+9)
  const currentTime = `${String(currentHour % 24).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  let sent = 0
  let skipped = 0
  let errors = 0

  try {
    // 配信設定を取得
    const settings = await getDripSettings()

    // 配信時間帯チェック
    if (!isWithinSendWindow(currentTime, settings.sendWindowStart, settings.sendWindowEnd)) {
      return NextResponse.json({
        message: '配信時間帯外です',
        currentTime,
        window: `${settings.sendWindowStart} - ${settings.sendWindowEnd}`,
      })
    }

    // アクティブなエンロールメントを取得
    const enrollments = await prisma.dripEnrollment.findMany({
      where: { status: 'active' },
      include: {
        user: { select: { id: true, name: true, email: true, plan: true, firstLoginAt: true, createdAt: true } },
        sequence: {
          include: {
            steps: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    })

    for (const enrollment of enrollments) {
      const { user, sequence } = enrollment

      // ユーザーチェック
      if (!user.email) { skipped++; continue }

      // 配信停止チェック
      const unsubscribed = await prisma.dripUnsubscribe.findFirst({
        where: { userId: user.id },
      })
      if (unsubscribed) {
        await prisma.dripEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'cancelled' },
        })
        skipped++
        continue
      }

      // シーケンスがアクティブか
      if (sequence.status !== 'active') { skipped++; continue }

      // 次のステップを特定
      const nextStepIndex = enrollment.currentStep
      const nextStep = sequence.steps[nextStepIndex]
      if (!nextStep) {
        // 全ステップ完了
        await prisma.dripEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'completed', completedAt: now },
        })
        continue
      }

      // 配信タイミングチェック: enrolled_at + dayOffset 日後
      const enrolledAt = new Date(enrollment.enrolledAt)
      const targetDate = new Date(enrolledAt)
      targetDate.setDate(targetDate.getDate() + nextStep.dayOffset)

      // まだ配信日に達していない
      if (now < targetDate) { skipped++; continue }

      // 配信時刻チェック（ステップの sendTime と現在時刻の比較、1時間の猶予）
      const stepTime = nextStep.sendTime || '09:00'
      if (!isTimeReady(currentTime, stepTime)) { skipped++; continue }

      // 二重配信防止
      const existingLog = await prisma.dripEmailLog.findFirst({
        where: {
          enrollmentId: enrollment.id,
          stepId: nextStep.id,
        },
      })
      if (existingLog) {
        // 既に送信済みなら次のステップへ進める
        await prisma.dripEnrollment.update({
          where: { id: enrollment.id },
          data: { currentStep: nextStepIndex + 1 },
        })
        skipped++
        continue
      }

      // 条件分岐の評価
      if (nextStep.conditionType && nextStepIndex > 0) {
        const prevStep = sequence.steps[nextStepIndex - 1]
        const prevLog = await prisma.dripEmailLog.findFirst({
          where: {
            enrollmentId: enrollment.id,
            stepId: prevStep.id,
          },
        })

        if (!evaluateCondition(nextStep.conditionType, prevLog)) {
          // 条件を満たさない → このステップをスキップして次へ
          await prisma.dripEnrollment.update({
            where: { id: enrollment.id },
            data: { currentStep: nextStepIndex + 1 },
          })
          skipped++
          continue
        }
      }

      // テンプレート取得
      if (!nextStep.templateId) {
        skipped++
        continue
      }
      const template = await prisma.dripTemplate.findUnique({
        where: { id: nextStep.templateId },
      })
      if (!template) {
        skipped++
        continue
      }

      // トラッキングID生成
      const trackingId = crypto.randomUUID()

      // 変数展開
      const variables = buildVariables(user, enrollment)
      let html = replaceVariables(template.bodyHtml, variables)

      // 開封トラッキングピクセル挿入
      const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://doya-ai.surisuta.jp'
      html += `<img src="${baseUrl}/api/t/open/${trackingId}" width="1" height="1" alt="" style="display:none" />`

      // 本文内リンクをクリックトラッキングURLに変換
      html = wrapLinksWithTracking(html, trackingId, baseUrl)

      // 配信停止リンク追加
      if (settings.unsubscribeEnabled) {
        const unsubToken = generateUnsubscribeToken(user.id)
        html += `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;">
          <a href="${baseUrl}/api/drip/unsubscribe?token=${unsubToken}" style="color:#999;">配信停止はこちら</a>
        </div>`
      }

      // メール送信
      const subject = replaceVariables(template.subject, variables)
      const result = await sendEmail({
        to: user.email,
        subject,
        html,
        from: settings.fromName
          ? `${settings.fromName} <${settings.fromEmail || 'noreply@doya-ai.surisuta.jp'}>`
          : settings.fromEmail || undefined,
        replyTo: settings.replyTo || undefined,
        tags: [
          { name: 'type', value: 'drip' },
          { name: 'sequence', value: sequence.id },
          { name: 'step', value: nextStep.id },
        ],
      })

      if (result.success) {
        // 配信ログ記録
        await prisma.dripEmailLog.create({
          data: {
            enrollmentId: enrollment.id,
            stepId: nextStep.id,
            userId: user.id,
            sequenceId: sequence.id,
            status: 'sent',
            trackingId,
            sentAt: now,
          },
        })

        // エンロールメントを次のステップへ
        const isLastStep = nextStepIndex >= sequence.steps.length - 1
        await prisma.dripEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStep: nextStepIndex + 1,
            ...(isLastStep ? { status: 'completed', completedAt: now } : {}),
          },
        })

        sent++
      } else {
        // 送信失敗ログ
        await prisma.dripEmailLog.create({
          data: {
            enrollmentId: enrollment.id,
            stepId: nextStep.id,
            userId: user.id,
            sequenceId: sequence.id,
            status: 'failed',
            trackingId,
            sentAt: now,
          },
        })
        errors++
        console.error(`[Drip] Failed to send to ${user.email}:`, result.error)
      }

      // レート制限（1秒間隔）
      if (settings.rateLimit && settings.rateLimit > 0) {
        await sleep(Math.max(1000, Math.floor(3600000 / settings.rateLimit)))
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      sent,
      skipped,
      errors,
      totalEnrollments: enrollments.length,
    })
  } catch (e) {
    console.error('[Drip] Cron error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ============================================
// ヘルパー関数
// ============================================

interface DripSettings {
  fromName: string
  fromEmail: string
  replyTo: string
  timezone: string
  sendWindowStart: string
  sendWindowEnd: string
  rateLimit: number
  unsubscribeEnabled: boolean
}

async function getDripSettings(): Promise<DripSettings> {
  const rows = await prisma.dripSetting.findMany()
  const map: Record<string, unknown> = {}
  for (const r of rows) {
    map[r.key] = r.value
  }
  return {
    fromName: (map.fromName as string) || 'ドヤAI',
    fromEmail: (map.fromEmail as string) || 'noreply@doya-ai.surisuta.jp',
    replyTo: (map.replyTo as string) || '',
    timezone: (map.timezone as string) || 'Asia/Tokyo',
    sendWindowStart: (map.sendWindowStart as string) || '08:00',
    sendWindowEnd: (map.sendWindowEnd as string) || '21:00',
    rateLimit: (map.rateLimit as number) || 100,
    unsubscribeEnabled: map.unsubscribeEnabled !== false,
  }
}

function isWithinSendWindow(current: string, start: string, end: string): boolean {
  const c = timeToMinutes(current)
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  return c >= s && c <= e
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function isTimeReady(current: string, stepTime: string): boolean {
  const c = timeToMinutes(current)
  const s = timeToMinutes(stepTime)
  // ステップの配信時刻から1時間以内であれば配信OK
  return c >= s && c <= s + 60
}

interface PrevLog {
  openedAt: Date | null
  clickedAt: Date | null
}

function evaluateCondition(conditionType: string, prevLog: PrevLog | null): boolean {
  if (!prevLog) return false // 前ステップが未送信なら条件不成立

  switch (conditionType) {
    case 'not_opened':
      return prevLog.openedAt === null
    case 'opened':
      return prevLog.openedAt !== null
    case 'not_clicked':
      return prevLog.clickedAt === null
    case 'clicked':
      return prevLog.clickedAt !== null
    case 'opened_not_clicked':
      return prevLog.openedAt !== null && prevLog.clickedAt === null
    default:
      return true
  }
}

interface UserInfo {
  id: string
  name: string | null
  email: string | null
  plan: string
  firstLoginAt: Date | null
  createdAt: Date
}

interface EnrollmentInfo {
  enrolledAt: Date
}

function buildVariables(user: UserInfo, enrollment: EnrollmentInfo): Record<string, string> {
  const now = new Date()
  const lastLogin = user.firstLoginAt || user.createdAt
  const daysSinceLogin = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24))

  return {
    user_name: user.name || 'お客様',
    email: user.email || '',
    plan: user.plan || 'FREE',
    last_login: lastLogin.toLocaleDateString('ja-JP'),
    days_since_login: String(daysSinceLogin),
    registered_at: user.createdAt.toLocaleDateString('ja-JP'),
    enrolled_at: enrollment.enrolledAt.toLocaleDateString('ja-JP'),
  }
}

function replaceVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

function wrapLinksWithTracking(html: string, trackingId: string, baseUrl: string): string {
  // href="..." のリンクをトラッキングURLに変換
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_, url) => {
      // 配信停止リンクや自サイトのトラッキングURLはスキップ
      if (url.includes('/api/t/') || url.includes('/unsubscribe')) return `href="${url}"`
      const linkId = Buffer.from(url).toString('base64url')
      return `href="${baseUrl}/api/t/click/${trackingId}/${linkId}"`
    }
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
