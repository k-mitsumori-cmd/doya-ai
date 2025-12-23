import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateBanners, isNanobannerConfigured, getModelDisplayName } from '@/lib/nanobanner'
import { prisma } from '@/lib/prisma'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL, getBannerDailyLimitByUserPlan } from '@/lib/pricing'
import crypto from 'crypto'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const maxDuration = 300

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

type FromUrlRequest = {
  // 互換: 旧UIでは targetUrl/camelCase。新UIでは target_url/snake_case（URLのみ入力）
  targetUrl?: string
  target_url?: string
  bannerPurpose?: string
  industry?: string
  size?: string
  requiredText?: string
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
  size: string
  language: 'ja'
  optional_assets: { logo_image?: string; person_images?: number }
  brand_constraints: { main_color?: string; sub_color?: string; tone_keywords?: string }
  compliance: { avoid?: string; must_include?: string }
  page_meta: { title?: string; description?: string }
  page_text: string
  color_hints: string
}) {
  // ユーザー提示プロンプト（仕様）に合わせて、URLのみから解析→最終画像プロンプトまで作る
  return `あなたは「Webサイトを一瞬で理解し、最適な広告バナーを自動生成するAI」です。

この機能の最大の価値は、ユーザーが【一切プロンプトを書かず】、【サイトURLを入力するだけ】で、そのサイトに“本当に合った”バナーを生成できることです。

ユーザーから与えられる入力は、以下の1つのみです。
- target_url: ${input.target_url}

それ以外の条件（用途・業種・トーン・コピー・色・CTA・構成）は、すべてあなたがサイト内容から自動で判断・補完してください。

---

## 1. サイト自動解析（最重要）
target_url を実際に見て、以下を必ず読み取ってください。
- このサイトは「何のサービス / 会社」か
- 誰向けのサービスか（ターゲット）
- 何が一番の強み・価値か（1〜3点）
- サイト全体のトーン（信頼感 / 高級感 / テック / 親しみ / ポップ / 採用向け 等）
- メインカラー・サブカラー（視覚的に判断）
- 最も自然なCTA（問い合わせ / 資料DL / 申し込み / 採用応募など）
※ 明示されていない情報は、サイト全体の文脈から「広告として最も自然な形」で推定してよい。

## 2. バナー用コピーを自動設計
以下をすべて自動で作成すること。
- メイン見出し（バナーで一番目立たせる一文）
- 補助コピー（0〜2行）
- CTA文言（1つ）
※ サイトに明確な数字・実績がある場合のみ根拠として使用。嘘・過剰表現は禁止。

## 3. デザイン判断（人間のデザイナーの思考を再現）
- バナーの雰囲気、配色、文字量、余白、情報優先順位、写真or抽象背景を自動決定
- 採用系なら人物感、BtoBなら信頼感を優先
重要ルール：
- 文字は必ず「読める」「正しい日本語」
- 装飾よりも“一瞬で理解できる”こと最優先
- 広告バナーとしてCTRが出そうな構成

## 4. 画像生成AIに渡す最終プロンプトを作成
- 日本語バナーであること
- 見出し・補助コピー・CTAをすべて含める
- 文字が崩れないよう強く指示
- 配色・雰囲気・構図を具体的に記述
- 広告バナー品質（高解像度・シャープ）

## 5. 出力形式（必須）
次の2つだけを出力する（JSONのみ。余計な文章やキーは禁止）：
{
  "banner_analysis": "",
  "image_generation_prompt": ""
}

---

### システムから渡す補助情報（解析の材料）
- size: ${input.size}
- language: ${input.language}
- optional_assets:
  - logo_image: ${input.optional_assets.logo_image ? 'あり（提供済み）' : 'なし'}
  - person_images: ${input.optional_assets.person_images ? `${input.optional_assets.person_images}枚（提供済み）` : 'なし'}
- brand_constraints:
  - main_color: ${input.brand_constraints.main_color || '未指定'}
  - sub_color: ${input.brand_constraints.sub_color || '未指定'}
  - tone_keywords: ${input.brand_constraints.tone_keywords || '未指定'}
- compliance:
  - avoid: ${input.compliance.avoid || '未指定'}
  - must_include: ${input.compliance.must_include || '未指定'}
- page_title: ${safeTrim(input.page_meta.title, 200)}
- page_description: ${safeTrim(input.page_meta.description, 320)}
- color_hints: ${safeTrim(input.color_hints, 800)}

### page_text（重要：ページ本文の抜粋）
${safeTrim(input.page_text, 18000)}

## 最重要
- image_generation_prompt は「そのまま画像生成AIに渡せる完成形」にする（1本のプロンプト）。
- バナー内の文字が読みやすいよう、文字数を詰め込みすぎない。
- 虚偽・過剰表現は禁止。`
}

function extractColorHints(html: string): string {
  try {
    const theme = (html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']{1,32})["']/i)?.[1] || '').trim()
    const all = html.match(/#[0-9a-fA-F]{3,6}\b/g) || []
    const normalized = all
      .map((c) => c.toUpperCase())
      .map((c) => (c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c))
      .filter((c) => /^#[0-9A-F]{6}$/.test(c))
    const freq = new Map<string, number>()
    for (const c of normalized) freq.set(c, (freq.get(c) || 0) + 1)
    const top = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([c, n]) => `${c}(${n})`)
      .join(', ')
    const parts = []
    if (theme) parts.push(`theme-color=${theme}`)
    if (top) parts.push(`html/css hex top=${top}`)
    return parts.join(' / ')
  } catch {
    return ''
  }
}

function isValidSizeString(v: string): boolean {
  const s = String(v || '').trim()
  if (!/^\d{2,4}x\d{2,4}$/.test(s)) return false
  const [wStr, hStr] = s.split('x')
  const w = Number(wStr)
  const h = Number(hStr)
  if (!Number.isFinite(w) || !Number.isFinite(h)) return false
  if (w < 100 || h < 100) return false
  if (w > 4096 || h > 4096) return false
  return true
}

function toAbsoluteUrl(maybeUrl: string, baseUrl: string): string | null {
  const raw = String(maybeUrl || '').trim()
  if (!raw) return null
  try {
    return new URL(raw, baseUrl).toString()
  } catch {
    return null
  }
}

function extractImageCandidates(html: string, baseUrl: string): string[] {
  const picks: string[] = []
  const take = (re: RegExp) => {
    const m = html.match(re)
    const u = m?.[1]?.trim()
    const abs = u ? toAbsoluteUrl(u, baseUrl) : null
    if (abs) picks.push(abs)
  }
  // og / twitter
  take(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']{1,500})["'][^>]*>/i)
  take(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']{1,500})["'][^>]*>/i)
  // icons
  take(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']{1,500})["'][^>]*>/i)
  take(/<link[^>]+rel=["']icon["'][^>]+href=["']([^"']{1,500})["'][^>]*>/i)
  take(/<link[^>]+rel=["']shortcut icon["'][^>]+href=["']([^"']{1,500})["'][^>]*>/i)
  // 重複排除
  return Array.from(new Set(picks)).slice(0, 4)
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}

async function extractPaletteFromImages(urls: string[], timeoutMs = 6000): Promise<string[]> {
  const colors: string[] = []
  for (const u of urls) {
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), timeoutMs)
      const res = await fetch(u, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DoyaBannerAI/1.0)' },
        signal: controller.signal,
      })
      clearTimeout(t)
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      // 小さくしてから統計（高速化）
      const stats = await sharp(buf).resize(128, 128, { fit: 'inside' }).stats()
      const d = (stats as any)?.dominant
      if (d && typeof d.r === 'number') {
        colors.push(rgbToHex(d.r, d.g, d.b))
      } else {
        // フォールバック：平均値
        const ch = stats.channels || []
        if (ch.length >= 3) colors.push(rgbToHex(ch[0].mean, ch[1].mean, ch[2].mean))
      }
    } catch {
      continue
    }
  }
  // 上位3色まで
  return Array.from(new Set(colors)).slice(0, 3)
}

export async function POST(request: NextRequest) {
  try {
    const disableLimits = process.env.DOYA_DISABLE_LIMITS === '1'
    const session = await getServerSession(authOptions)
    const isGuest = !session
    const today = new Date().toISOString().split('T')[0]
    const userId = !isGuest ? ((session?.user as any)?.id as string | undefined) : undefined

    const body = (await request.json()) as FromUrlRequest
    const targetUrl = safeTrim(body?.targetUrl || body?.target_url, 2000)
    const requestedSizeRaw = safeTrim(body?.size, 32) || '1080x1080'
    const category = safeTrim(body?.industry, 40) || 'other'
    const appPurpose = safeTrim(body?.purpose, 32) || 'sns_ad'
    const requestedCountRaw = Number(body?.count)
    const requestedCount = Number.isFinite(requestedCountRaw) ? Math.floor(requestedCountRaw) : 3
    const planRaw = !isGuest
      ? String((session?.user as any)?.bannerPlan || (session?.user as any)?.plan || 'FREE').toUpperCase()
      : 'GUEST'
    const isPaidUser = !isGuest && planRaw !== 'FREE'

    // ==============================
    // 枚数/サイズの強制（改ざん対策）
    // - 無料/ゲスト：3枚固定・1080x1080固定
    // - 有料：3〜10枚、サイズ指定可（範囲チェック）
    // ==============================
    const desiredCount = isPaidUser ? Math.max(3, Math.min(10, requestedCount || 3)) : 3
    const size = isPaidUser ? (isValidSizeString(requestedSizeRaw) ? requestedSizeRaw : '1080x1080') : '1080x1080'

    if (!targetUrl || !isValidHttpUrl(targetUrl)) {
      return NextResponse.json({ error: 'URLが不正です（https://〜 を入力してください）' }, { status: 400 })
    }
    if (!isNanobannerConfigured()) {
      return NextResponse.json({ error: 'バナー生成APIが設定されていません。管理者にお問い合わせください。' }, { status: 503 })
    }

    // 日次上限（画像枚数）
    if (!disableLimits) {
      if (isGuest) {
        // ゲストは generate ルート側でcookie管理しているため、ここでは簡易に弾く（重複生成を避ける）
        if (desiredCount > BANNER_PRICING.guestLimit) {
          return NextResponse.json(
            {
              error: 'ゲストは本日分の生成上限を超えています。ログインしてご利用ください。',
              code: 'DAILY_LIMIT_REACHED',
              upgradeUrl: '/auth/doyamarke/signin?callbackUrl=%2Fbanner',
            },
            { status: 429 }
          )
        }
      } else {
        const userId = (session?.user as any)?.id as string | undefined
        const dailyLimit = getBannerDailyLimitByUserPlan(planRaw)
        if (userId && dailyLimit !== -1) {
          const sub = await prisma.userServiceSubscription.findUnique({
            where: { userId_serviceId: { userId, serviceId: 'banner' } },
            select: { dailyUsage: true, lastUsageReset: true, plan: true },
          })
          const used = sub?.dailyUsage || 0
          if (used + desiredCount > dailyLimit) {
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
    const colorHintsFromHtml = extractColorHints(html)
    // 画像（OG/ICON）から実色を抽出（HTMLだけだと外れるため）
    const imageCandidates = extractImageCandidates(html, targetUrl)
    const paletteFromImages = await extractPaletteFromImages(imageCandidates)
    const colorHints = [
      colorHintsFromHtml ? `html=${colorHintsFromHtml}` : '',
      paletteFromImages.length > 0 ? `image_palette=${paletteFromImages.join(',')}` : '',
      imageCandidates.length > 0 ? `image_sources=${imageCandidates.slice(0, 2).join(',')}` : '',
    ]
      .filter(Boolean)
      .join(' / ')

    const apiKey = getApiKey()
    const specPrompt = buildWebsiteBannerPrompt({
      target_url: targetUrl,
      size,
      language: 'ja',
      optional_assets: {
        logo_image: body.logoImage ? 'provided' : undefined,
        person_images: Array.isArray(body.personImages) ? body.personImages.length : 0,
      },
      brand_constraints: { main_color: body.mainColor, sub_color: body.subColor, tone_keywords: body.toneKeywords },
      compliance: { avoid: body.avoid, must_include: body.mustInclude },
      page_meta: meta,
      page_text: pageText,
      color_hints: colorHints,
    })

    const structured = await callGeminiForJson(specPrompt, apiKey)
    const bannerAnalysis = safeTrim(structured?.banner_analysis, 6000)
    const imagePrompt = safeTrim(structured?.image_generation_prompt, 24000)
    // 互換: 旧promptでは negative_prompt を返していた。なければ空でOK。
    const negativePrompt = safeTrim(structured?.negative_prompt, 6000)

    if (!imagePrompt) {
      return NextResponse.json({ error: 'サイト解析はできましたが、画像生成プロンプトの生成に失敗しました。' }, { status: 500 })
    }

    // 画像生成（Nano Banana Pro）
    const options = {
      purpose: appPurpose,
      logoImage: body.logoImage,
      // 人物写真は1名（1枚）に固定
      personImages: Array.isArray(body.personImages) ? body.personImages.slice(0, 1) : undefined,
      referenceImages: Array.isArray(body.referenceImages) ? body.referenceImages : undefined,
      // brandColors が未指定なら、抽出したパレットを使用（色抽出精度UP）
      brandColors: Array.isArray(body.brandColors) ? body.brandColors : (paletteFromImages.length > 0 ? paletteFromImages : undefined),
      // URLのみ入力のため、最終プロンプトをそのまま使用
      customImagePrompt: imagePrompt,
      negativePrompt,
    }

    // keyword は履歴/メタ用途。なければ title を採用（customImagePromptを使うので生成品質には影響しない）
    const keywordForMeta = safeTrim(meta.title, 80) || 'URL自動生成'
    const result = await generateBanners(category || 'other', keywordForMeta, size, options as any, desiredCount)

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
                keyword: keywordForMeta,
                size,
                purpose: appPurpose || 'sns_ad',
                count: desiredCount,
                source: 'url',
                targetUrl,
                bannerPurpose: 'auto',
              },
              output: img,
              outputType: 'IMAGE',
              metadata: {
                batchId,
                category,
                purpose: appPurpose || 'sns_ad',
                size,
                keyword: keywordForMeta,
                targetUrl,
                bannerPurpose: 'auto',
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
            desiredCount,
            Array.isArray(result.banners) ? result.banners.filter((b) => typeof b === 'string' && b.startsWith('data:image/')).length : desiredCount
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

    // レスポンス
    // - bannerAnalysis: 解析結果（テキスト）
    // - analysisJson: UI互換用（legacy）に key_message / cta / tone を切り出して返す
    const legacyAnalysisJson = {
      key_message: bannerAnalysis || undefined,
      cta: undefined as string | undefined,
      tone: undefined as string | undefined,
    }
    // bannerAnalysis からCTA/トーンの推定（簡易パース）
    const ctaMatch = String(bannerAnalysis || '').match(/(CTA|アクション)[：:]\s*(.{2,30})/i)
    if (ctaMatch) legacyAnalysisJson.cta = ctaMatch[2].split(/[、。]/)[0].trim()
    const toneMatch = String(bannerAnalysis || '').match(/(トーン|雰囲気)[：:]\s*(.{2,20})/i)
    if (toneMatch) legacyAnalysisJson.tone = toneMatch[2].split(/[、。]/)[0].trim()

    const res = NextResponse.json({
      banners: result.banners,
      bannerAnalysis: bannerAnalysis || undefined,
      analysisJson: legacyAnalysisJson, // UI互換
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


