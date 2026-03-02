import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateBanners, isNanobannerConfigured, getModelDisplayName } from '@/lib/nanobanner'
import { prisma } from '@/lib/prisma'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL, getBannerMonthlyLimitByUserPlan, shouldResetMonthlyUsage, getCurrentMonthJST, isWithinFreeHour } from '@/lib/pricing'
import { sendErrorNotification } from '@/lib/notifications'
import crypto from 'crypto'

// Vercel上で画像生成が長引くことがあるため、実行時間上限を引き上げる
// （環境/プランによって上限は異なります）
export const maxDuration = 300

// レート制限用（簡易的な実装）
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1分
const RATE_LIMIT_MAX_GUEST = 3 // ゲストは1分あたり3リクエストまで
const RATE_LIMIT_MAX_USER = 10 // ログインユーザーは1分あたり10リクエストまで

// ゲストの月次上限（Cookieで簡易管理）
const BANNER_GUEST_USAGE_COOKIE = 'doya_banner_guest_usage'
type GuestMonthlyUsage = { date: string; count: number } // date = "YYYY-MM"

function readGuestMonthlyUsage(request: NextRequest, currentMonth: string): GuestMonthlyUsage {
  try {
    const raw = request.cookies.get(BANNER_GUEST_USAGE_COOKIE)?.value
    if (!raw) return { date: currentMonth, count: 0 }
    const parsed = JSON.parse(raw) as any
    const date = typeof parsed?.date === 'string' ? parsed.date : currentMonth
    const count = Number(parsed?.count)
    // 月が変わっていたらリセット（YYYY-MM比較、旧YYYY-MM-DD形式にも対応）
    if (date.slice(0, 7) !== currentMonth) return { date: currentMonth, count: 0 }
    return { date: currentMonth, count: Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0 }
  } catch {
    return { date: currentMonth, count: 0 }
  }
}

function checkRateLimit(ip: string, isGuest: boolean): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  const maxRequests = isGuest ? RATE_LIMIT_MAX_GUEST : RATE_LIMIT_MAX_USER
  
  if (!record || record.resetTime < now) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (record.count >= maxRequests) {
    return false
  }
  
  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const disableLimits = process.env.DOYA_DISABLE_LIMITS === '1'
    // セッションチェック
    const session = await getServerSession(authOptions)
    const isGuest = !session
    const currentMonth = getCurrentMonthJST() // 月次管理用 "YYYY-MM"

    // IPアドレスを取得
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown'

    // レート制限チェック
    if (!disableLimits && !checkRateLimit(ip, isGuest)) {
      return NextResponse.json(
        { error: 'リクエストが多すぎます。1分ほど待ってから再試行してください。' },
        { status: 429 }
      )
    }

    // リクエストボディを取得
    const body = await request.json()
    const { 
      category, 
      keyword, 
      size, 
      purpose,
      count,
      companyName,
      imageDescription,
      headlineText,
      subheadText,
      ctaText,
      logoImage,
      personImage,
      personImages,
      referenceImages,
      brandColors,
      shareToGallery,
      shareProfile,
    } = body

    // バリデーション
    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { error: 'カテゴリを選択してください' },
        { status: 400 }
      )
    }

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: '訴求内容を入力してください' },
        { status: 400 }
      )
    }

    if (keyword.length > 200) {
      return NextResponse.json(
        { error: '訴求内容は200文字以内で入力してください' },
        { status: 400 }
      )
    }

    // 生成枚数（デフォルト3 / 有料は最大10）
    const requestedCountRaw = Number(count)
    const requestedCount = Number.isFinite(requestedCountRaw) ? Math.floor(requestedCountRaw) : 3

    // API設定チェック
    if (!isNanobannerConfigured()) {
      console.warn('Nanobanner API is not configured')
      return NextResponse.json(
        { error: 'バナー生成APIが設定されていません。管理者にお問い合わせください。' },
        { status: 503 }
      )
    }

    console.log(`Banner generation request - Category: ${category}, Purpose: ${purpose}, Size: ${size}, Guest: ${isGuest}`)
    if (companyName) console.log(`Company: ${companyName}`)
    if (imageDescription) console.log(`Image description: ${imageDescription.slice(0, 50)}...`)
    if (logoImage) console.log('Logo image provided')
    if (personImage) console.log('Person image provided')
    if (Array.isArray(personImages) && personImages.length > 0) console.log(`Person images: ${personImages.length}`)
    if (Array.isArray(referenceImages) && referenceImages.length > 0) console.log(`Reference images: ${referenceImages.length}`)
    if (Array.isArray(brandColors) && brandColors.length > 0) console.log(`Brand colors: ${brandColors.length}`)

    // #RGB/#RRGGBB を正規化
    const normalizeHex = (v: string): string | null => {
      const s = String(v || '').trim()
      const m = s.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
      if (!m) return null
      const raw = m[1]
      const hex = raw.length === 3
        ? raw.split('').map((c) => c + c).join('')
        : raw
      return `#${hex.toUpperCase()}`
    }

    // バナー生成オプション
    // 人物写真は「1名（1枚）」のみ対応（サーバ側で厳密にガード）
    const normalizedPersonImages = Array.isArray(personImages)
      ? personImages.filter((x: any) => typeof x === 'string' && x.startsWith('data:image/')).slice(0, 1)
      : []
    const options = {
      purpose: purpose || 'sns_ad',
      companyName: companyName?.trim() || undefined,
      imageDescription: imageDescription?.trim() || undefined,
      headlineText: typeof headlineText === 'string' ? headlineText.trim() || undefined : undefined,
      subheadText: typeof subheadText === 'string' ? subheadText.trim() || undefined : undefined,
      ctaText: typeof ctaText === 'string' ? ctaText.trim() || undefined : undefined,
      hasLogo: !!logoImage,
      hasPerson: !!(personImage || normalizedPersonImages.length > 0),
      logoImage: logoImage || undefined,
      personImage: personImage || undefined, // 互換用
      personImages: normalizedPersonImages.length > 0 ? normalizedPersonImages : undefined,
      referenceImages: Array.isArray(referenceImages)
        ? referenceImages.filter((x: any) => typeof x === 'string').slice(0, 2)
        : undefined,
      brandColors: Array.isArray(brandColors)
        ? brandColors
            .map((x: any) => (typeof x === 'string' ? normalizeHex(x) : null))
            .filter((x: string | null): x is string => typeof x === 'string')
            .slice(0, 8)
        : undefined,
    }

    // ==============================
    // 月次上限（サーバ側で厳密に強制）
    // ==============================
    let usageInfo: null | { monthlyLimit: number; monthlyUsed: number; monthlyRemaining: number } = null
    let guestUsage: GuestMonthlyUsage | null = null

    // 生成枚数（サーバ側で厳密に強制する：フロント改ざん対策）
    // - デフォルト3枚
    // - 有料のみ最大10枚
    const userId = !isGuest ? ((session?.user as any)?.id as string | undefined) : undefined
    let desiredCount = Math.max(1, Math.min(3, requestedCount || 3))

    if (!disableLimits && isGuest) {
      guestUsage = readGuestMonthlyUsage(request, currentMonth)
      const monthlyLimit = BANNER_PRICING.guestLimit
      const monthlyUsed = guestUsage.count
      if (monthlyLimit !== -1 && monthlyUsed + desiredCount > monthlyLimit) {
        return NextResponse.json(
          {
            error: '今月の生成上限に達しました。プロプランにアップグレードしてください。',
            code: 'MONTHLY_LIMIT_REACHED',
            usage: {
              monthlyLimit,
              monthlyUsed,
              monthlyRemaining: Math.max(0, monthlyLimit - monthlyUsed),
            },
            upgradeUrl: '/banner',
          },
          { status: 429 }
        )
      }
      usageInfo = {
        monthlyLimit,
        monthlyUsed,
        monthlyRemaining: monthlyLimit === -1 ? -1 : Math.max(0, monthlyLimit - monthlyUsed),
      }
    } else if (!disableLimits && !isGuest) {
      if (userId) {
        try {
          // ユーザーの firstLoginAt を取得して「1時間生成し放題」かどうか判定
          const userRecord = await prisma.user.findUnique({
            where: { id: userId },
            select: { firstLoginAt: true },
          })
          const isFreeHourActive = isWithinFreeHour(userRecord?.firstLoginAt)

          const current = await prisma.userServiceSubscription.upsert({
            where: { userId_serviceId: { userId, serviceId: 'banner' } },
            create: {
              userId,
              serviceId: 'banner',
              plan: 'FREE',
              dailyUsage: 0,
              monthlyUsage: 0,
              lastUsageReset: new Date(),
            },
            update: {},
          })

          // 月が変わっていたらmonthlyUsageをリセット（日本時間基準）
          const needsMonthlyReset = shouldResetMonthlyUsage(current.lastUsageReset)

          const normalized = needsMonthlyReset
            ? await prisma.userServiceSubscription.update({
                where: { id: current.id },
                data: {
                  monthlyUsage: 0,
                  lastUsageReset: new Date(),
                },
              })
            : current

          const plan = String(normalized.plan || 'FREE').toUpperCase()
          const isPaidPlan = plan === 'PRO' || plan === 'ENTERPRISE'

          // 1時間生成し放題中は最大10枚まで許可（有料と同等）
          desiredCount = Math.max(1, Math.min((isPaidPlan || isFreeHourActive) ? 10 : 3, requestedCount || 3))
          // NOTE: 生成上限は「画像枚数」ベース（月間）
          const monthlyLimit = getBannerMonthlyLimitByUserPlan(plan)

          // 1時間生成し放題中は月次上限チェックをスキップ
          if (!isFreeHourActive && monthlyLimit !== -1 && normalized.monthlyUsage + desiredCount > monthlyLimit) {
            const errorMessage = isPaidPlan
              ? '今月の生成上限に達しました。上限をさらにUPしたい場合は「マーケティング施策を丸投げする」からご相談ください。'
              : '今月の生成上限に達しました。プロプランにアップグレードしてください。'
            return NextResponse.json(
              {
                error: errorMessage,
                code: 'MONTHLY_LIMIT_REACHED',
                usage: {
                  monthlyLimit,
                  monthlyUsed: normalized.monthlyUsage,
                  monthlyRemaining: Math.max(0, monthlyLimit - normalized.monthlyUsage),
                },
                upgradeUrl: isPaidPlan ? (HIGH_USAGE_CONTACT_URL || '/banner') : '/banner',
              },
              { status: 429 }
            )
          }

          usageInfo = {
            monthlyLimit: isFreeHourActive ? -1 : monthlyLimit, // 1時間中は無制限扱い
            monthlyUsed: normalized.monthlyUsage,
            monthlyRemaining: (isFreeHourActive || monthlyLimit === -1) ? -1 : Math.max(0, monthlyLimit - normalized.monthlyUsage),
          }
        } catch (e: any) {
          console.error('Banner usage limit check failed (Prisma error):', e)
          // データベースエラー時は制限を緩和して生成を続行（ユーザー体験を優先）
          // usageInfo は null のまま
        }
      }
    }

    // バナー生成
    const result = await generateBanners(
      category,
      keyword.trim(),
      size || '1080x1080',
      options,
      // 無料/ゲストは原則3枚固定。有料のみ最大10まで。
      // プラン判定は usageInfo の dailyLimit と session から推定しているが、ここでは desiredCount を採用する。
      desiredCount
    )

    if (result.error && result.banners.length === 0) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // ==============================
    // 履歴保存（ログインユーザーのみ / DB）
    // ギャラリー公開の場合は metadata.shared=true を付与
    // ==============================
    if (!isGuest && userId) {
      try {
        const banners = Array.isArray(result.banners) ? result.banners : []
        const images = banners.filter((b) => typeof b === 'string' && b.startsWith('data:image/'))
        if (images.length > 0) {
          const nowIso = new Date().toISOString()
          const patterns = 'ABCDEFGHIJ'.split('')
          const batchId = crypto.randomUUID()
          const shared = shareToGallery === true
          await prisma.generation.createMany({
            data: images.map((img: string, idx: number) => ({
              userId,
              serviceId: 'banner',
              input: {
                category,
                keyword: keyword.trim(),
                size: size || '1080x1080',
                purpose: purpose || 'sns_ad',
                count: desiredCount,
              },
              output: img,
              outputType: 'IMAGE',
              metadata: {
                batchId,
                category,
                purpose: purpose || 'sns_ad',
                size: size || '1080x1080',
                keyword: keyword.trim(),
                pattern: patterns[idx] || String(idx + 1),
                usedModel: result.usedModel || null,
                shared,
                ...(shared ? { sharedAt: nowIso, shareProfile: shareProfile === true } : {}),
              },
            })),
          })
        }
      } catch (e: any) {
        console.error('Banner history persist failed:', e)
        // 履歴保存失敗でも生成自体は成功しているので落とさない
      }
    }

    // 成功時のみ使用回数を加算（画像枚数ベース・月間）
    const chargedCount = Math.max(1, Math.min(desiredCount, Array.isArray(result.banners) ? result.banners.length : desiredCount))
    if (!disableLimits && isGuest && guestUsage) {
      guestUsage = { date: currentMonth, count: guestUsage.date === currentMonth ? guestUsage.count + chargedCount : chargedCount }
      if (usageInfo) {
        usageInfo = {
          monthlyLimit: usageInfo.monthlyLimit,
          monthlyUsed: guestUsage.count,
          monthlyRemaining: usageInfo.monthlyLimit === -1 ? -1 : Math.max(0, usageInfo.monthlyLimit - guestUsage.count),
        }
      }
    } else if (!disableLimits && !isGuest) {
      if (userId) {
        try {
          const updated = await prisma.userServiceSubscription.update({
            where: { userId_serviceId: { userId, serviceId: 'banner' } },
            data: {
              monthlyUsage: { increment: chargedCount },
            },
          })
          if (usageInfo) {
            usageInfo = {
              monthlyLimit: usageInfo.monthlyLimit,
              monthlyUsed: updated.monthlyUsage,
              monthlyRemaining: Math.max(0, usageInfo.monthlyLimit - updated.monthlyUsage),
            }
          }
        } catch (e: any) {
          console.error('Banner usage increment failed:', e)
          // 生成自体は成功しているので、ここでは失敗させない
        }
      }
    }

    const res = NextResponse.json({
      banners: result.banners,
      isGuest,
      warning: result.error, // 一部失敗した場合の警告
      usage: usageInfo || undefined,
      usedModel: result.usedModel || undefined,
      usedModelDisplay: result.usedModel ? getModelDisplayName(result.usedModel) : undefined,
    })

    if (!disableLimits && isGuest && guestUsage) {
      res.cookies.set(BANNER_GUEST_USAGE_COOKIE, JSON.stringify(guestUsage), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 45, // 45日
      })
    }

    return res

  } catch (error: any) {
    console.error('Banner generation API error:', error)
    sendErrorNotification({
      errorMessage: error?.message || 'Banner generation failed',
      errorStack: error?.stack,
      pathname: '/api/banner/generate',
      requestMethod: 'POST',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})

    return NextResponse.json(
      { error: 'バナー生成中にエラーが発生しました。しばらく待ってから再試行してください。' },
      { status: 500 }
    )
  }
}

// GETメソッドは許可しない
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
