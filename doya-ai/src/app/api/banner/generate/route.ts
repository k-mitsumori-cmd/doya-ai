import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateBanners, isNanobannerConfigured } from '@/lib/nanobanner'
import { prisma } from '@/lib/prisma'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'

// レート制限用（簡易的な実装）
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1分
const RATE_LIMIT_MAX_GUEST = 3 // ゲストは1分あたり3リクエストまで
const RATE_LIMIT_MAX_USER = 10 // ログインユーザーは1分あたり10リクエストまで

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
      companyName,
      logoImage,
      personImage,
      referenceImages,
      brandColors,
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
    if (logoImage) console.log('Logo image provided')
    if (personImage) console.log('Person image provided')
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
    const options = {
      purpose: purpose || 'sns_ad',
      companyName: companyName?.trim() || undefined,
      hasLogo: !!logoImage,
      hasPerson: !!personImage,
      logoImage: logoImage || undefined,
      personImage: personImage || undefined,
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
    // 日次上限（サーバ側で厳密に強制）
    // ==============================
    let usageInfo: null | { dailyLimit: number; dailyUsed: number; dailyRemaining: number } = null
    if (!disableLimits && !isGuest) {
      const userId = (session?.user as any)?.id as string | undefined
      if (userId) {
        const today = new Date().toISOString().split('T')[0] // UTC日付
        const planRaw = String((session?.user as any)?.plan || 'FREE').toUpperCase()
        const isPaid =
          planRaw === 'PRO' || planRaw === 'BUNDLE' || planRaw === 'BUSINESS' || planRaw === 'ENTERPRISE' || planRaw === 'PREMIUM'
        const desiredPlan = isPaid ? 'PRO' : 'FREE'
        const dailyLimit = isPaid ? BANNER_PRICING.proLimit : BANNER_PRICING.freeLimit

        try {
          const current = await prisma.userServiceSubscription.upsert({
            where: { userId_serviceId: { userId, serviceId: 'banner' } },
            create: {
              userId,
              serviceId: 'banner',
              plan: desiredPlan,
              dailyUsage: 0,
              monthlyUsage: 0,
              lastUsageReset: new Date(),
            },
            update: {
              plan: desiredPlan,
            },
          })

          // 日付/月が変わっていたらリセット
          const lastDay = current.lastUsageReset.toISOString().split('T')[0]
          const lastMonth = current.lastUsageReset.toISOString().slice(0, 7)
          const thisMonth = new Date().toISOString().slice(0, 7)
          const needsDailyReset = lastDay !== today
          const needsMonthlyReset = lastMonth !== thisMonth

          const normalized = needsDailyReset || needsMonthlyReset
            ? await prisma.userServiceSubscription.update({
                where: { id: current.id },
                data: {
                  dailyUsage: needsDailyReset ? 0 : current.dailyUsage,
                  monthlyUsage: needsMonthlyReset ? 0 : current.monthlyUsage,
                  lastUsageReset: needsDailyReset || needsMonthlyReset ? new Date() : current.lastUsageReset,
                },
              })
            : current

          if (normalized.dailyUsage >= dailyLimit) {
            return NextResponse.json(
              {
                error: '本日の使用回数上限に達しました。上位利用をご希望の場合はお問い合わせください。',
                code: 'DAILY_LIMIT_REACHED',
                usage: {
                  dailyLimit,
                  dailyUsed: normalized.dailyUsage,
                  dailyRemaining: 0,
                },
                upgradeUrl: HIGH_USAGE_CONTACT_URL || '/banner/pricing',
              },
              { status: 429 }
            )
          }

          usageInfo = {
            dailyLimit,
            dailyUsed: normalized.dailyUsage,
            dailyRemaining: Math.max(0, dailyLimit - normalized.dailyUsage),
          }
        } catch (e: any) {
          console.error('Banner usage limit check failed:', e)
          return NextResponse.json(
            { error: '現在サーバ側の使用回数確認に失敗しました。時間をおいてお試しください。' },
            { status: 503 }
          )
        }
      }
    }

    // バナー生成
    const result = await generateBanners(
      category,
      keyword.trim(),
      size || '1080x1080',
      options
    )

    if (result.error && result.banners.length === 0) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // 成功時のみ使用回数を加算（1リクエスト=1回）
    if (!disableLimits && !isGuest) {
      const userId = (session?.user as any)?.id as string | undefined
      if (userId) {
        try {
          const updated = await prisma.userServiceSubscription.update({
            where: { userId_serviceId: { userId, serviceId: 'banner' } },
            data: {
              dailyUsage: { increment: 1 },
              monthlyUsage: { increment: 1 },
            },
          })
          if (usageInfo) {
            usageInfo = {
              dailyLimit: usageInfo.dailyLimit,
              dailyUsed: updated.dailyUsage,
              dailyRemaining: Math.max(0, usageInfo.dailyLimit - updated.dailyUsage),
            }
          }
        } catch (e: any) {
          console.error('Banner usage increment failed:', e)
          // 生成自体は成功しているので、ここでは失敗させない
        }
      }
    }

    return NextResponse.json({
      banners: result.banners,
      isGuest,
      warning: result.error, // 一部失敗した場合の警告
      usage: usageInfo || undefined,
    })

  } catch (error: any) {
    console.error('Banner generation API error:', error)
    
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
