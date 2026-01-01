import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import {
  BANNER_PRICING,
  getBannerDailyLimitByUserPlan,
  shouldResetDailyUsage,
  getTodayDateJST,
  isWithinFreeHour,
  HIGH_USAGE_CONTACT_URL,
} from '@/lib/pricing'

export const runtime = 'nodejs'
export const maxDuration = 120

// ========================================
// Schema
// ========================================
const PersonaGenerateRequestSchema = z.object({
  url: z.string().min(1).max(2000),
  productName: z.string().max(200).optional(),
  price: z.string().max(200).optional(),
  features: z.string().max(4000).optional(),
  target: z.string().max(1000).optional(),
  objective: z.string().max(200).optional(),
  mustInclude: z.string().max(1000).optional(),
  avoid: z.string().max(1000).optional(),
  notes: z.string().max(6000).optional(),
})

type PersonaGenerateRequest = z.infer<typeof PersonaGenerateRequestSchema>

type SiteExtract = {
  url: string
  title: string
  description: string
  headings: string[]
  text: string
}

type PersonaGenerateResponse = {
  site: SiteExtract
  output: any
  model: string
  usage?: {
    dailyLimit: number
    dailyUsed: number
    dailyRemaining: number
  }
}

// ========================================
// Guest usage cookie (shared with banner)
// ========================================
const PERSONA_GUEST_USAGE_COOKIE = 'doya_persona_guest_usage'
type GuestDailyUsage = { date: string; count: number }

function readGuestDailyUsage(request: NextRequest, today: string): GuestDailyUsage {
  try {
    const raw = request.cookies.get(PERSONA_GUEST_USAGE_COOKIE)?.value
    if (!raw) return { date: today, count: 0 }
    const parsed = JSON.parse(raw) as any
    const date = typeof parsed?.date === 'string' ? parsed.date : today
    const count = typeof parsed?.count === 'number' ? parsed.count : 0
    if (date !== today) return { date: today, count: 0 }
    return { date, count }
  } catch {
    return { date: today, count: 0 }
  }
}

// ========================================
// Helpers
// ========================================
function safeTrim(v: any, max = 4000): string {
  const s = typeof v === 'string' ? v : ''
  return s.trim().slice(0, max)
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function stripHtmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  const text = withoutScripts
    .replace(/<\/(p|div|br|li|h1|h2|h3|h4|h5|h6|tr|td)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  return text
}

function extractMeta(html: string) {
  const pick = (re: RegExp) => {
    const m = html.match(re)
    return m?.[1]?.trim() || ''
  }
  const title = pick(/<title[^>]*>([^<]{1,200})<\/title>/i)
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})["'][^>]*>/i)
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["'][^>]*>/i)
  const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,300})["'][^>]*>/i)
  return {
    title: ogTitle || title,
    description: ogDesc || desc,
  }
}

function extractHeadings(html: string): string[] {
  const out: string[] = []
  const re = /<(h1|h2|h3)\b[^>]*>([\s\S]{0,500}?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const raw = m[2] || ''
    const text = stripHtmlToText(raw)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)
    if (text) out.push(text)
    if (out.length >= 24) break
  }
  return out
}

async function fetchHtml(targetUrl: string, timeoutMs = 12_000): Promise<string> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DoyaPersona/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    })
    const html = await res.text()
    if (!res.ok) throw new Error(`status=${res.status}`)
    return html.slice(0, 900_000)
  } finally {
    clearTimeout(t)
  }
}

function buildPrompt(args: { req: PersonaGenerateRequest; site: SiteExtract }): string {
  const { req, site } = args
  const userDetails = [
    req.productName ? `商品/サービス名: ${safeTrim(req.productName, 200)}` : '',
    req.price ? `価格/プラン: ${safeTrim(req.price, 200)}` : '',
    req.features ? `特徴/機能/強み: ${safeTrim(req.features, 4000)}` : '',
    req.target ? `ターゲット補足: ${safeTrim(req.target, 1000)}` : '',
    req.objective ? `目的（CV）: ${safeTrim(req.objective, 200)}` : '',
    req.mustInclude ? `必ず入れる要素: ${safeTrim(req.mustInclude, 1000)}` : '',
    req.avoid ? `避ける表現/NG: ${safeTrim(req.avoid, 1000)}` : '',
    req.notes ? `その他メモ: ${safeTrim(req.notes, 6000)}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return `あなたは「日本で売れるマーケ素材」を設計する、超優秀なマーケティングコンサル兼コピーライターです。
以下のWebサイトURLから得た情報を元に、ペルソナ設計と、それに合わせたクリエイティブ（キャッチコピー/LP要素/広告文/メール等）を作ってください。

【重要ルール】
- 断定的な嘘（実績/数値/受賞など根拠がないもの）は書かない。サイト本文/メタ/与えた追加情報から推測できる範囲で書く。
- 日本語として自然で、実務でそのまま使える文にする（抽象語だけで終わらせない）。
- 迷ったら「売れる方向」に寄せる（ベネフィット→証拠→不安払拭→CTA）。
- 不確かな点は assumptions / questions に入れて補う。

【入力：サイト解析結果】
url: ${site.url}
title: ${safeTrim(site.title, 200)}
description: ${safeTrim(site.description, 320)}
headings: ${site.headings.slice(0, 18).join(' / ')}

本文抜粋:
${safeTrim(site.text, 16000)}

【入力：ユーザー追加情報（任意）】
${userDetails || '（なし）'}

【出力形式（JSONのみ。余計な文章・Markdown・コードフェンス禁止）】
{
  "siteSummary": {
    "industry": "",
    "offer": "",
    "valueProposition": "",
    "differentiators": ["", ""],
    "proofPoints": ["", ""],
    "primaryCTA": "",
    "secondaryCTA": ""
  },
  "personas": [
    {
      "id": "p1",
      "name": "",
      "archetype": "",
      "demographics": { "ageRange": "", "gender": "", "location": "", "jobTitle": "", "companySize": "", "incomeRange": "" },
      "situation": "",
      "goals": ["", ""],
      "pains": ["", ""],
      "desiredOutcome": "",
      "objections": ["", ""],
      "triggers": ["", ""],
      "decisionCriteria": ["", ""],
      "channels": ["", ""],
      "searchKeywords": ["", ""],
      "messagingAngles": ["", ""],
      "bestOffer": "",
      "recommendedCTA": ""
    }
  ],
  "creative": {
    "catchCopy": {
      "heroHeadlines": ["", "", "", "", ""],
      "heroSubheads": ["", "", ""],
      "ctaButtons": ["", "", ""]
    },
    "lpStructure": [
      { "section": "ファーストビュー", "goal": "", "copy": "" },
      { "section": "課題提起", "goal": "", "copy": "" },
      { "section": "解決策", "goal": "", "copy": "" },
      { "section": "特徴/機能", "goal": "", "copy": "" },
      { "section": "実績/根拠", "goal": "", "copy": "" },
      { "section": "不安払拭", "goal": "", "copy": "" },
      { "section": "CTA", "goal": "", "copy": "" }
    ],
    "ads": {
      "googleSearch": [
        { "headline1": "", "headline2": "", "description": "", "path1": "", "path2": "" }
      ],
      "metaAds": [
        { "primaryText": "", "headline": "", "description": "", "cta": "" }
      ]
    },
    "snsPosts": [
      { "channel": "X", "post": "" },
      { "channel": "Instagram", "post": "" }
    ],
    "email": {
      "subjectLines": ["", "", ""],
      "preheaders": ["", "", ""],
      "bodyDrafts": ["", ""]
    }
  },
  "marketingChecklist": [
    { "priority": "high", "item": "", "reason": "", "example": "" }
  ],
  "assumptions": ["", ""],
  "questionsToAsk": ["", ""]
}
`
}

// ========================================
// POST Handler
// ========================================
export async function POST(request: NextRequest) {
  try {
    const disableLimits = process.env.DOYA_DISABLE_LIMITS === '1'
    const session = await getServerSession(authOptions)
    const isGuest = !session
    const today = getTodayDateJST()
    const userId = !isGuest ? ((session?.user as any)?.id as string | undefined) : undefined

    // Parse request
    const body = (await request.json().catch(() => null)) as unknown
    const parsed = PersonaGenerateRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'リクエストが不正です', details: parsed.error.flatten() }, { status: 400 })
    }

    const req = parsed.data
    const url = safeTrim(req.url, 2000)
    if (!isValidHttpUrl(url)) {
      return NextResponse.json({ error: 'URLが不正です（https://〜 を入力してください）' }, { status: 400 })
    }

    // ========================================
    // Usage limit check (same as Banner AI)
    // ========================================
    const planRaw = !isGuest
      ? String((session?.user as any)?.bannerPlan || (session?.user as any)?.plan || 'FREE').toUpperCase()
      : 'GUEST'

    // 1時間生成し放題の判定
    const firstLoginAt = (session?.user as any)?.firstLoginAt
    const isFreeHourActive = !isGuest && isWithinFreeHour(firstLoginAt)

    let guestUsage: GuestDailyUsage | null = null
    let usageInfo: { dailyLimit: number; dailyUsed: number; dailyRemaining: number } | null = null

    if (!disableLimits) {
      if (isGuest) {
        // Guest: use cookie
        guestUsage = readGuestDailyUsage(request, today)
        const dailyLimit = BANNER_PRICING.guestLimit
        const dailyUsed = guestUsage.count
        usageInfo = { dailyLimit, dailyUsed, dailyRemaining: Math.max(0, dailyLimit - dailyUsed) }

        if (dailyUsed >= dailyLimit) {
          return NextResponse.json(
            {
              error: 'ゲストは本日分の生成上限を超えています。ログインしてご利用ください。',
              code: 'DAILY_LIMIT_REACHED',
              usage: usageInfo,
              upgradeUrl: '/auth/doyamarke/signin?callbackUrl=%2Fpersona',
            },
            { status: 429 }
          )
        }
      } else {
        // Logged-in user
        if (!isFreeHourActive) {
          const dailyLimit = getBannerDailyLimitByUserPlan(planRaw)
          if (userId && dailyLimit !== -1) {
            const sub = await prisma.userServiceSubscription.findUnique({
              where: { userId_serviceId: { userId, serviceId: 'banner' } },
              select: { dailyUsage: true, lastUsageReset: true, plan: true },
            })

            let used = sub?.dailyUsage || 0
            if (shouldResetDailyUsage(sub?.lastUsageReset)) {
              used = 0
              prisma.userServiceSubscription
                .update({
                  where: { userId_serviceId: { userId, serviceId: 'banner' } },
                  data: { dailyUsage: 0, lastUsageReset: new Date() },
                })
                .catch(() => {})
            }

            usageInfo = { dailyLimit, dailyUsed: used, dailyRemaining: Math.max(0, dailyLimit - used) }

            if (used >= dailyLimit) {
              return NextResponse.json(
                {
                  error: '本日の生成上限に達しました。',
                  code: 'DAILY_LIMIT_REACHED',
                  usage: usageInfo,
                  upgradeUrl: planRaw === 'FREE' ? '/banner/pricing' : HIGH_USAGE_CONTACT_URL || '/banner/pricing',
                },
                { status: 429 }
              )
            }
          }
        }
      }
    }

    // ========================================
    // Fetch and parse HTML
    // ========================================
    const html = await fetchHtml(url).catch((e: any) => {
      throw new Error(`URLの取得に失敗しました（${e?.message || 'timeout'}）`)
    })
    const meta = extractMeta(html)
    const headings = extractHeadings(html)
    const text = stripHtmlToText(html)

    const site: SiteExtract = {
      url,
      title: safeTrim(meta.title, 200),
      description: safeTrim(meta.description, 320),
      headings,
      text: safeTrim(text, 26000),
    }

    // ========================================
    // Generate with Gemini
    // ========================================
    const prompt = buildPrompt({ req, site })

    const output = await geminiGenerateJson<any>(
      {
        model: GEMINI_TEXT_MODEL_DEFAULT,
        prompt,
        generationConfig: { temperature: 0.35, maxOutputTokens: 8192 },
      },
      'DoyaPersonaSchema'
    )

    // ========================================
    // Increment usage
    // ========================================
    if (!disableLimits) {
      if (isGuest && guestUsage) {
        guestUsage = { date: today, count: guestUsage.count + 1 }
        if (usageInfo) {
          usageInfo = {
            dailyLimit: usageInfo.dailyLimit,
            dailyUsed: guestUsage.count,
            dailyRemaining: Math.max(0, usageInfo.dailyLimit - guestUsage.count),
          }
        }
      } else if (!isGuest && userId) {
        try {
          await prisma.userServiceSubscription
            .update({
              where: { userId_serviceId: { userId, serviceId: 'banner' } },
              data: { dailyUsage: { increment: 1 }, monthlyUsage: { increment: 1 } },
            })
            .catch(() => {})

          // Update usageInfo
          if (usageInfo) {
            usageInfo = {
              dailyLimit: usageInfo.dailyLimit,
              dailyUsed: usageInfo.dailyUsed + 1,
              dailyRemaining: Math.max(0, usageInfo.dailyRemaining - 1),
            }
          }
        } catch (e: any) {
          console.error('persona usage increment failed:', e)
        }
      }
    }

    // ========================================
    // Response
    // ========================================
    const res: PersonaGenerateResponse = {
      site,
      output,
      model: GEMINI_TEXT_MODEL_DEFAULT,
      usage: usageInfo || undefined,
    }

    const response = NextResponse.json(res)

    // Set guest cookie
    if (!disableLimits && isGuest && guestUsage) {
      response.cookies.set(PERSONA_GUEST_USAGE_COOKIE, JSON.stringify(guestUsage), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 2, // 2日
      })
    }

    return response
  } catch (e: any) {
    console.error('persona/generate error:', e)
    return NextResponse.json({ error: e?.message || '生成に失敗しました' }, { status: 500 })
  }
}
