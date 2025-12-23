import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateBanners, isNanobannerConfigured, getModelDisplayName } from '@/lib/nanobanner'
import { prisma } from '@/lib/prisma'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL, getBannerDailyLimitByUserPlan } from '@/lib/pricing'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 300

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

type FromUrlRequest = {
  targetUrl: string
  bannerPurpose: string
  industry?: string
  size: string
  requiredText: string
  language?: 'ja'
  // optional assets
  logoImage?: string
  personImages?: string[]
  // brand constraints
  mainColor?: string
  subColor?: string
  toneKeywords?: string
  // compliance
  avoid?: string
  mustInclude?: string
  // app integrations
  purpose?: string // app purpose key (sns_ad/youtube/...)
  referenceImages?: string[]
  brandColors?: string[]
  shareToGallery?: boolean
  shareProfile?: boolean
  count?: number
}

function getApiKey(): string {
  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.NANOBANNER_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY が設定されていません')
  return apiKey
}

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
    .replace(/<\/(p|div|br|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
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

function coerceJson(text: string): any {
  const t = String(text || '').trim()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {}
  // code fence / extra text 対策：最初の { ... } を抜く
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1))
    } catch {}
  }
  return null
}

async function callGeminiForJson(prompt: string, apiKey: string): Promise<any> {
  const models = ['gemini-3-pro-preview', 'gemini-3-flash-preview']
  let lastErr: string | null = null

  for (const model of models) {
    try {
      const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
      const buildBody = (jsonMode: boolean) => ({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
          topP: 0.9,
          topK: 40,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      })

      const attempt = async (jsonMode: boolean) =>
        fetch(`${endpoint}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildBody(jsonMode)),
        })

      let res = await attempt(true)
      if (res.status === 502 || res.status === 503) {
        await new Promise((r) => setTimeout(r, 700))
        res = await attempt(true)
      }

      if (!res.ok) {
        const t = await res.text()
        // JSONモードが弾かれたら通常モードで再試行
        if (res.status === 400 && (t.includes('responseMimeType') || t.includes('INVALID_ARGUMENT'))) {
          let retry = await attempt(false)
          if (retry.status === 502 || retry.status === 503) {
            await new Promise((r) => setTimeout(r, 700))
            retry = await attempt(false)
          }
          if (retry.ok) {
            const json = await retry.json()
            const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => (p?.text ? String(p.text) : '')).join('\n').trim()
            const parsed = coerceJson(text)
            if (parsed) return parsed
          }
          lastErr = `Gemini ${model} error (retry): ${retry.status} - ${(await retry.text()).substring(0, 400)}`
          continue
        }
        lastErr = `Gemini ${model} error: ${res.status} - ${t.substring(0, 400)}`
        continue
      }

      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => (p?.text ? String(p.text) : '')).join('\n').trim()
      const parsed = coerceJson(text)
      if (!parsed) {
        lastErr = `Gemini ${model} returned non-JSON`
        continue
      }
      return parsed
    } catch (e: any) {
      lastErr = `Gemini failed: ${e?.message || e}`
      continue
    }
  }
  throw new Error(lastErr || 'Gemini failed')
}

function buildWebsiteBannerPrompt(input: {
  target_url: string
  banner_purpose: string
  industry: string
  size: string
  language: 'ja'
  required_text: string
  optional_assets: { logo_image?: string; person_images?: number }
  brand_constraints: { main_color?: string; sub_color?: string; tone_keywords?: string }
  compliance: { avoid?: string; must_include?: string }
  page_meta: { title?: string; description?: string }
  page_text: string
}) {
  // ユーザー提示プロンプトを“仕様”として埋め込み、そこに抽出元データを渡す
  return `あなたは「Webサイト解析 × バナー制作」のプロです。
ユーザーが入力したURLのページ内容を元に、広告/LP/告知に使える高品質なバナー画像を生成してください。

# 0. 入力（ユーザー or システムから渡される）
- target_url: ${input.target_url}
- banner_purpose: ${input.banner_purpose}
- industry: ${input.industry}
- size: ${input.size}
- language: ${input.language}
- required_text: ${input.required_text}
- optional_assets:
  - logo_image: ${input.optional_assets.logo_image ? 'あり（提供済み）' : 'なし'}
  - person_images: ${input.optional_assets.person_images ? `${input.optional_assets.person_images}枚（提供済み）` : 'なし'}
- brand_constraints:
  - main_color: ${input.brand_constraints.main_color || '未指定'}
  - sub_color: ${input.brand_constraints.sub_color || '未指定'}
  - tone_keywords: ${input.brand_constraints.tone_keywords || '未指定'}
- compliance:
  - avoid: ${input.compliance.avoid || '未指定'}
  - must_include: ${input.compliance.must_include || '未指定（required_text に含める想定）'}

# 1. Webページ解析（必須）
以下を target_url から抽出・推定して構造化する：
- サービス/商品の名称（正式名）
- 主要価値（ベネフィット）上位3つ（短い日本語で）
- 根拠（実績/数字/導入社/受賞/特徴）上位3つ（ページ内にあるもの優先）
- 想定ターゲット（誰向けか）
- トーン&マナー（ページの印象：信頼/高級/テック/カジュアル等）
- ブランドカラー（主要色を推定。指定があれば優先）
- CTA（問い合わせ/資料DLなど、banner_purposeに沿って最適化）

抽出できない情報がある場合は「推定」で補完し、推定した箇所を明確に区別する。

# 2. コピー設計（バナー用・短く強く）
- required_text は絶対に改変せず、そのまま画像に入れる（必須）。
- required_text 以外の補助コピーを 0〜2個まで作る（短い、刺さる、誇張しない）。
- CTA文言を 1つ作る（例：無料で資料DL / まずは相談 / 詳しく見る）。誇張禁止。
- 数字や固有名詞はページの根拠がある場合のみ使用。

# 3. デザイン指示（バナー生成のルール）
- 画像内の文字は必ず「読める」こと。最優先。
- required_text は視認性の高い位置に配置（FV中央/上部など）。改行や文字詰めは可、文字自体は改変禁止。
- 背景は “読みやすさ” を損なわない。装飾より可読性優先。
- logo_image があれば左上or右上に配置。なければサイト名をタイポで表現。
- person_images があれば “顔が切れない / 重要要素に被らない / CTA付近に配置しない”。
- 画面内の要素順序は「見出し(required_text) → 補助コピー → CTA → 根拠（実績/特徴）」。
- 根拠要素は最大2点まで（例：「導入〇〇社」「満足度〇〇%」など）。ない場合は無理に入れない。

# 4. 出力形式（必須）
以下を必ず出力する（JSONのみ、余計な文章は禁止）：

{
  "analysis_json": {
    "extracted": {},
    "inferred": {},
    "palette": {},
    "tone": "",
    "key_message": "",
    "cta": ""
  },
  "image_generation_prompt": "",
  "negative_prompt": ""
}

## 解析に使えるページ情報（抽出元）
- page_title: ${safeTrim(input.page_meta.title, 200)}
- page_description: ${safeTrim(input.page_meta.description, 320)}

### page_text（重要：ページ本文の抜粋）
${safeTrim(input.page_text, 18000)}

## 追加の厳守事項
- required_text は必ず画像内に入り、1文字たりとも欠落・改変しない。
- 日本語は自然で正しい表記にする。
- バナーとしてのCTRを意識しつつも、虚偽・誇張はしない。
`
}

export async function POST(request: NextRequest) {
  try {
    const disableLimits = process.env.DOYA_DISABLE_LIMITS === '1'
    const session = await getServerSession(authOptions)
    const isGuest = !session
    const today = new Date().toISOString().split('T')[0]
    const userId = !isGuest ? ((session?.user as any)?.id as string | undefined) : undefined

    const body = (await request.json()) as FromUrlRequest
    const targetUrl = safeTrim(body?.targetUrl, 2000)
    const bannerPurpose = safeTrim(body?.bannerPurpose, 100) || 'サービス認知'
    const size = safeTrim(body?.size, 32) || '1080x1080'
    const requiredText = safeTrim(body?.requiredText, 200)
    const category = safeTrim(body?.industry, 40) || 'other'
    const appPurpose = safeTrim(body?.purpose, 32) || 'sns_ad'
    const requestedCountRaw = Number(body?.count)
    const requestedCount = Number.isFinite(requestedCountRaw) ? Math.floor(requestedCountRaw) : 3

    if (!targetUrl || !isValidHttpUrl(targetUrl)) {
      return NextResponse.json({ error: 'URLが不正です（https://〜 を入力してください）' }, { status: 400 })
    }
    if (!requiredText) {
      return NextResponse.json({ error: 'required_text（画像内に必ず入れるテキスト）を入力してください' }, { status: 400 })
    }
    if (!isNanobannerConfigured()) {
      return NextResponse.json({ error: 'バナー生成APIが設定されていません。管理者にお問い合わせください。' }, { status: 503 })
    }

    // 日次上限（画像枚数）
    if (!disableLimits) {
      if (isGuest) {
        // ゲストは generate ルート側でcookie管理しているため、ここでは簡易に弾く（重複生成を避ける）
        if (requestedCount > BANNER_PRICING.guestLimit) {
          return NextResponse.json({ error: 'ゲストは本日分の生成上限を超えています。ログインしてご利用ください。', code: 'DAILY_LIMIT_REACHED', upgradeUrl: '/auth/signin' }, { status: 429 })
        }
      } else {
        const userId = (session?.user as any)?.id as string | undefined
        const planRaw = String((session?.user as any)?.bannerPlan || (session?.user as any)?.plan || 'FREE').toUpperCase()
        const dailyLimit = getBannerDailyLimitByUserPlan(planRaw)
        if (userId && dailyLimit !== -1) {
          const sub = await prisma.userServiceSubscription.findUnique({
            where: { userId_serviceId: { userId, serviceId: 'banner' } },
            select: { dailyUsage: true, lastUsageReset: true, plan: true },
          })
          const used = sub?.dailyUsage || 0
          if (used + requestedCount > dailyLimit) {
            return NextResponse.json(
              {
                error: '本日の生成上限に達しました。',
                code: 'DAILY_LIMIT_REACHED',
                usage: { dailyLimit, dailyUsed: used, dailyRemaining: Math.max(0, dailyLimit - used) },
                upgradeUrl: planRaw === 'FREE' ? '/banner/pricing' : (HIGH_USAGE_CONTACT_URL || '/banner/pricing'),
              },
              { status: 429 }
            )
          }
        }
      }
    }

    // URL からHTML取得
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    let html = ''
    try {
      const res = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DoyaBannerAI/1.0; +https://doya-ai.vercel.app)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      })
      html = await res.text()
      if (!res.ok) {
        return NextResponse.json({ error: `URLの取得に失敗しました（status=${res.status}）` }, { status: 400 })
      }
    } catch (e: any) {
      return NextResponse.json({ error: `URLの取得に失敗しました（${e?.message || 'timeout'}）` }, { status: 400 })
    } finally {
      clearTimeout(timeout)
    }

    const meta = extractMeta(html)
    const pageText = stripHtmlToText(html)

    const apiKey = getApiKey()
    const specPrompt = buildWebsiteBannerPrompt({
      target_url: targetUrl,
      banner_purpose: bannerPurpose,
      industry: category,
      size,
      language: 'ja',
      required_text: requiredText,
      optional_assets: { logo_image: body.logoImage ? 'provided' : undefined, person_images: Array.isArray(body.personImages) ? body.personImages.length : 0 },
      brand_constraints: { main_color: body.mainColor, sub_color: body.subColor, tone_keywords: body.toneKeywords },
      compliance: { avoid: body.avoid, must_include: body.mustInclude },
      page_meta: meta,
      page_text: pageText,
    })

    const structured = await callGeminiForJson(specPrompt, apiKey)
    const analysisJson = structured?.analysis_json || null
    const imagePrompt = safeTrim(structured?.image_generation_prompt, 24000)
    const negativePrompt = safeTrim(structured?.negative_prompt, 6000)

    if (!imagePrompt) {
      return NextResponse.json({ error: 'サイト解析はできましたが、画像生成プロンプトの生成に失敗しました。' }, { status: 500 })
    }

    // 画像生成（Nano Banana Pro）
    const options = {
      purpose: appPurpose,
      logoImage: body.logoImage,
      personImages: Array.isArray(body.personImages) ? body.personImages : undefined,
      referenceImages: Array.isArray(body.referenceImages) ? body.referenceImages : undefined,
      brandColors: Array.isArray(body.brandColors) ? body.brandColors : undefined,
      // required_text を画像内に必ず入れるため、keywordにも入れておく（内部hard constraintsで参照される）
      customImagePrompt: imagePrompt,
      negativePrompt,
    }

    const result = await generateBanners(category || 'other', requiredText, size, options as any, requestedCount)

    // ==============================
    // 履歴保存（ログインユーザーのみ / DB）
    // ==============================
    if (!isGuest && userId) {
      try {
        const banners = Array.isArray(result.banners) ? result.banners : []
        const images = banners.filter((b) => typeof b === 'string' && b.startsWith('data:image/'))
        if (images.length > 0) {
          const nowIso = new Date().toISOString()
          const patterns = 'ABCDEFGHIJ'.split('')
          const batchId = crypto.randomUUID()
          const shared = body?.shareToGallery === true
          await prisma.generation.createMany({
            data: images.map((img: string, idx: number) => ({
              userId,
              serviceId: 'banner',
              input: {
                category,
                keyword: requiredText,
                size,
                purpose: appPurpose || 'sns_ad',
                count: requestedCount,
                source: 'url',
                targetUrl,
                bannerPurpose,
              },
              output: img,
              outputType: 'IMAGE',
              metadata: {
                batchId,
                category,
                purpose: appPurpose || 'sns_ad',
                size,
                keyword: requiredText,
                targetUrl,
                bannerPurpose,
                pattern: patterns[idx] || String(idx + 1),
                usedModel: result.usedModel || null,
                shared,
                ...(shared ? { sharedAt: nowIso, shareProfile: body?.shareProfile === true } : {}),
              },
            })),
          })
        }
      } catch (e: any) {
        console.error('from-url history persist failed:', e)
      }
    }

    // ==============================
    // 使用回数加算（ログインユーザーのみ / 画像枚数ベース）
    // ==============================
    if (!disableLimits && !isGuest && userId) {
      try {
        const chargedCount = Math.max(
          1,
          Math.min(
            requestedCount,
            Array.isArray(result.banners) ? result.banners.filter((b) => typeof b === 'string' && b.startsWith('data:image/')).length : requestedCount
          )
        )
        await prisma.userServiceSubscription.update({
          where: { userId_serviceId: { userId, serviceId: 'banner' } },
          data: { dailyUsage: { increment: chargedCount }, monthlyUsage: { increment: chargedCount } },
        }).catch(() => {})
      } catch (e: any) {
        console.error('from-url usage increment failed:', e)
      }
    }

    const res = NextResponse.json({
      banners: result.banners,
      analysisJson,
      imagePrompt,
      negativePrompt,
      usedModel: result.usedModel || undefined,
      usedModelDisplay: result.usedModel ? getModelDisplayName(result.usedModel) : undefined,
      warning: result.error || undefined,
    })
    return res
  } catch (e: any) {
    console.error('from-url error:', e)
    return NextResponse.json({ error: e?.message || 'URLからの自動生成に失敗しました' }, { status: 500 })
  }
}


