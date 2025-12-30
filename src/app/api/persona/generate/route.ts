import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 120

const PersonaGenerateRequestSchema = z.object({
  url: z.string().min(1).max(2000),
  // 追加情報（任意）
  productName: z.string().max(200).optional(),
  price: z.string().max(200).optional(),
  features: z.string().max(4000).optional(),
  target: z.string().max(1000).optional(),
  objective: z.string().max(200).optional(), // 例: 問い合わせ/資料DL/購入/応募
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
    // 念のため過大HTMLを抑制
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

export async function POST(request: NextRequest) {
  try {
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

    const prompt = buildPrompt({ req, site })

    const output = await geminiGenerateJson<any>(
      {
        model: GEMINI_TEXT_MODEL_DEFAULT,
        prompt,
        generationConfig: { temperature: 0.35, maxOutputTokens: 8192 },
      },
      'DoyaPersonaSchema'
    )

    const res: PersonaGenerateResponse = {
      site,
      output,
      model: GEMINI_TEXT_MODEL_DEFAULT,
    }
    return NextResponse.json(res)
  } catch (e: any) {
    console.error('persona/generate error:', e)
    return NextResponse.json({ error: e?.message || '生成に失敗しました' }, { status: 500 })
  }
}



