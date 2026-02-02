// ========================================
// ドヤペルソナAI - ペルソナ生成API
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  PERSONA_PRICING,
  getPersonaDailyLimitByUserPlan,
  shouldResetDailyUsage,
  getTodayDateJST,
  isWithinFreeHour,
} from '@/lib/pricing'

// HTML解析用ユーティリティ
function extractTextFromHTML(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)
}

function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {}
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) meta.title = titleMatch[1].trim()

  const metaRegex = /<meta[^>]+>/gi
  let match
  while ((match = metaRegex.exec(html)) !== null) {
    const tag = match[0]
    const nameMatch = tag.match(/(?:name|property)=["']([^"']+)["']/i)
    const contentMatch = tag.match(/content=["']([^"']+)["']/i)
    if (nameMatch && contentMatch) {
      meta[nameMatch[1]] = contentMatch[1]
    }
  }
  return meta
}

function extractHeadings(html: string): string[] {
  const headings: string[] = []
  const regex = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    headings.push(match[1].trim())
  }
  return headings.slice(0, 10)
}

// JSON修復ユーティリティ
function repairJson(str: string): string {
  let jsonStr = str.trim()
  
  // コードブロック除去
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) jsonStr = jsonMatch[1].trim()
  
  // 先頭/末尾の余分なテキストを除去
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
  }
  
  // 閉じ括弧を補完
  const openBraces = (jsonStr.match(/{/g) || []).length
  const closeBraces = (jsonStr.match(/}/g) || []).length
  const openBrackets = (jsonStr.match(/\[/g) || []).length
  const closeBrackets = (jsonStr.match(/]/g) || []).length
  
  // 配列が閉じていない場合
  if (openBrackets > closeBrackets) {
    jsonStr += ']'.repeat(openBrackets - closeBrackets)
  }
  // オブジェクトが閉じていない場合
  if (openBraces > closeBraces) {
    jsonStr += '}'.repeat(openBraces - closeBraces)
  }
  
  // 末尾のカンマを修正
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')
  
  return jsonStr
}

// Gemini JSON生成
async function geminiGenerateJson<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY not configured')

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash']
  let lastError: Error | null = null

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
            },
          }),
        }
      )

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Gemini API error: ${res.status} - ${errText.slice(0, 200)}`)
      }

      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from Gemini')
      }
      
      // JSON修復と解析
      const jsonStr = repairJson(text)
      
      try {
        return JSON.parse(jsonStr) as T
      } catch (parseErr) {
        console.error('JSON parse error, raw text:', text.slice(0, 500))
        throw new Error(`JSON parse failed: ${(parseErr as Error).message}`)
      }
    } catch (e) {
      lastError = e as Error
      console.warn(`Model ${model} failed:`, e)
      continue
    }
  }

  throw lastError || new Error('All models failed')
}

// レスポンス型
interface PersonaResult {
  persona: {
    name: string
    age: number
    gender: string
    occupation: string
    income: string
    location: string
    familyStructure: string
    lifestyle: string
    challenges: string[]
    goals: string[]
    mediaUsage: string[]
    purchaseMotivation: string[]
    objections: string[]
    personalityTraits: string[]
    dayInLife: string
    quote: string
  }
  creatives: {
    catchphrases: string[]
    lpStructure: {
      hero: string
      problem: string
      solution: string
      benefits: string[]
      cta: string
    }
    adCopy: {
      google: string[]
      meta: string[]
    }
    emailDraft: {
      subject: string
      body: string
    }
  }
  marketingChecklist: {
    category: string
    items: { task: string; priority: 'high' | 'medium' | 'low' }[]
  }[]
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, additionalInfo, serviceName } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URLが必要です' }, { status: 400 })
    }

    // 認証チェック
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    let dailyLimit = PERSONA_PRICING.guestLimit
    let usedToday = 0
    let isUnlimited = false

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          plan: true, 
          personaUsageToday: true, 
          lastUsageReset: true,
          firstLoginAt: true 
        },
      })

      if (user) {
        // 初回ログイン1時間無制限
        if (isWithinFreeHour(user.firstLoginAt)) {
          isUnlimited = true
        }

        dailyLimit = getPersonaDailyLimitByUserPlan(user.plan)
        if (dailyLimit < 0) isUnlimited = true

        // 日次リセット
        if (shouldResetDailyUsage(user.lastUsageReset)) {
          await prisma.user.update({
            where: { id: userId },
            data: { personaUsageToday: 0, lastUsageReset: new Date() },
          })
          usedToday = 0
        } else {
          usedToday = user.personaUsageToday || 0
        }
      }
    } else {
      // ゲスト: IP制限（簡易）
      const ip = req.headers.get('x-forwarded-for') || 'unknown'
      // 本番ではRedis等でIPごとの利用回数を管理
    }

    // 制限チェック
    if (!isUnlimited && usedToday >= dailyLimit) {
      return NextResponse.json(
        {
          error: `本日の生成上限（${dailyLimit}回）に達しました`,
          usedToday,
          dailyLimit,
        },
        { status: 429 }
      )
    }

    // URLからHTML取得
    let html = ''
    try {
      const fetchRes = await fetch(url, {
        headers: { 'User-Agent': 'DoyaPersonaBot/1.0' },
        signal: AbortSignal.timeout(10000),
      })
      html = await fetchRes.text()
    } catch (e) {
      return NextResponse.json({ error: 'URLからコンテンツを取得できませんでした' }, { status: 400 })
    }

    const meta = extractMetaTags(html)
    const headings = extractHeadings(html)
    const plainText = extractTextFromHTML(html)

    // ペルソナ生成プロンプト
    const prompt = `
あなたは超優秀なマーケティングコンサルタントです。
以下のウェブサイト情報から、ターゲットペルソナとマーケティング施策を生成してください。

## サイト情報
- URL: ${url}
- タイトル: ${meta.title || '不明'}
- 説明: ${meta.description || meta['og:description'] || '不明'}
- 見出し: ${headings.join(' / ')}
- コンテンツ抜粋: ${plainText.slice(0, 3000)}

${additionalInfo ? `## 追加情報\n${additionalInfo}` : ''}
${serviceName ? `## サービス名\n${serviceName}` : ''}

## 出力形式（JSON）
以下の構造で出力してください。売れる素材になるよう、具体的で実践的な内容にしてください。

{
  "persona": {
    "name": "架空の日本人名（フルネーム）",
    "age": 35,
    "gender": "男性/女性",
    "occupation": "職業（具体的に）",
    "income": "年収帯",
    "location": "居住地",
    "familyStructure": "家族構成",
    "lifestyle": "ライフスタイルの特徴",
    "challenges": ["課題1", "課題2", "課題3"],
    "goals": ["目標1", "目標2"],
    "mediaUsage": ["よく使うメディア/SNS"],
    "purchaseMotivation": ["購買動機1", "購買動機2"],
    "objections": ["購入しない理由/反論"],
    "personalityTraits": ["性格特性1", "性格特性2"],
    "dayInLife": "1日の過ごし方の概要",
    "quote": "ペルソナの口癖や価値観を表す一言"
  },
  "creatives": {
    "catchphrases": ["キャッチコピー案1", "キャッチコピー案2", "キャッチコピー案3", "キャッチコピー案4", "キャッチコピー案5"],
    "lpStructure": {
      "hero": "ファーストビューのキャッチコピー",
      "problem": "課題提起セクションのコピー",
      "solution": "解決策セクションのコピー",
      "benefits": ["ベネフィット1", "ベネフィット2", "ベネフィット3"],
      "cta": "CTAボタンのテキスト"
    },
    "adCopy": {
      "google": ["Google検索広告コピー1", "Google検索広告コピー2"],
      "meta": ["Meta/SNS広告コピー1", "Meta/SNS広告コピー2"]
    },
    "emailDraft": {
      "subject": "メール件名",
      "body": "メール本文（200字程度）"
    }
  },
  "marketingChecklist": [
    {
      "category": "カテゴリ名",
      "items": [
        { "task": "タスク内容", "priority": "high" }
      ]
    }
  ]
}

重要: 必ず有効なJSONのみを出力してください。マークダウンや説明文は不要です。
`

    const result = await geminiGenerateJson<PersonaResult>(prompt)

    // 使用回数を更新
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { personaUsageToday: { increment: 1 } },
      })
    }

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        url,
        title: meta.title,
        usedToday: usedToday + 1,
        dailyLimit,
      },
    })
  } catch (error) {
    console.error('Persona generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ペルソナ生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

