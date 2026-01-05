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

type GuestDailyUsage = { date: string; count: number }
const PERSONA_GUEST_USAGE_COOKIE = 'doya_persona_guest_usage'

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

function readGuestDailyUsage(request: NextRequest, today: string): GuestDailyUsage {
  const raw = request.cookies.get(PERSONA_GUEST_USAGE_COOKIE)?.value
  const parsed = raw ? safeJsonParse<GuestDailyUsage>(raw) : null
  if (!parsed || typeof parsed?.date !== 'string' || typeof parsed?.count !== 'number') {
    return { date: today, count: 0 }
  }
  return parsed.date === today ? parsed : { date: today, count: 0 }
}

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
  // 生成が「いつまでも終わらない」を防ぐ（Vercel環境でのハング対策）
  const REQUEST_TIMEOUT_MS = 45_000

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
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
  analysis: {
    siteSummary: string
    keyOffer: string
    targetHypothesis: string
    whyThisPersona: string
    evidence: string[]
  }
  persona: {
    // 基本
    name: string
    age: number
    gender: string
    occupation: string
    industry?: string
    companySize?: string
    income: string
    location: string
    familyStructure: string
    education?: string
    lifestyle: string
    devices?: string[]
    // 深掘り
    challenges: string[]
    goals: string[]
    values?: string[]
    mediaUsage: string[]
    searchKeywords?: string[]
    purchaseMotivation: string[]
    objections: string[]
    objectionHandling?: string[]
    personalityTraits: string[]
    dayInLife: string
    quote: string
    // 生活の具体（履歴書下に出す）
    dailySchedule: {
      time: string
      title: string
      detail: string
      mood?: string
      imageCaption?: string
      sceneKeywords?: string[]
    }[]
    diary: {
      title: string
      body: string // 600〜1200字くらいの“日記”
      captionText: string // 画像に入れる短いテキスト（1〜2行）
      sceneKeywords: string[] // 画像生成の情景ヒント
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, additionalInfo, serviceName, basePersona, revision, brief } = body

    const urlStr = typeof url === 'string' ? url.trim() : ''
    const hasUrl = !!urlStr
    const briefObj = brief && typeof brief === 'object' ? (brief as Record<string, any>) : null
    const hasBrief = !!briefObj

    if (!hasUrl && !hasBrief) {
      return NextResponse.json({ error: 'URLまたは詳細入力が必要です' }, { status: 400 })
    }

    if (hasUrl && !/^https?:\/\//i.test(urlStr)) {
      return NextResponse.json({ error: 'URL形式が正しくありません（https://〜）' }, { status: 400 })
    }

    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    const isGuest = !userId
    const disableLimits = process.env.DOYA_DISABLE_LIMITS === '1' || process.env.PERSONA_DISABLE_LIMITS === '1'
    const today = getTodayDateJST()

    // ==============================
    // 日次上限（サーバ側で厳密に強制）
    // - persona は「1回=1生成」
    // ==============================
    let usageInfo:
      | null
      | { dailyLimit: number; dailyUsed: number; dailyRemaining: number; isFreeHour?: boolean } = null
    let guestUsage: GuestDailyUsage | null = null

    if (!disableLimits && isGuest) {
      guestUsage = readGuestDailyUsage(req, today)
      const dailyLimit = PERSONA_PRICING.guestLimit
      const dailyUsed = guestUsage.count
      if (dailyLimit !== -1 && dailyUsed + 1 > dailyLimit) {
        return NextResponse.json(
          {
            error: '本日の生成上限に達しました。ログインまたはプロプランにアップグレードしてください。',
            code: 'DAILY_LIMIT_REACHED',
            usage: {
              dailyLimit,
              dailyUsed,
              dailyRemaining: Math.max(0, dailyLimit - dailyUsed),
            },
            upgradeUrl: '/pricing',
          },
          { status: 429 }
        )
      }
      usageInfo = {
        dailyLimit,
        dailyUsed,
        dailyRemaining: dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - dailyUsed),
      }
    } else if (!disableLimits && !isGuest && userId) {
      try {
        const userRecord = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstLoginAt: true, plan: true },
        })
        const isFreeHourActive = isWithinFreeHour(userRecord?.firstLoginAt)

        const current = await prisma.userServiceSubscription.upsert({
          where: { userId_serviceId: { userId, serviceId: 'persona' } },
          create: {
            userId,
            serviceId: 'persona',
            plan: 'FREE',
            dailyUsage: 0,
            monthlyUsage: 0,
            lastUsageReset: new Date(),
          },
          update: {},
        })

        const needsDailyReset = shouldResetDailyUsage(current.lastUsageReset)
        const todayJST = today
        const thisMonthJST = todayJST.slice(0, 7)
        const jstOffset = 9 * 60 * 60 * 1000
        const lastMonthJST = new Date(current.lastUsageReset.getTime() + jstOffset).toISOString().slice(0, 7)
        const needsMonthlyReset = lastMonthJST !== thisMonthJST

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

        // サービス別プランが未設定（FREEのまま）でも、ポータル全体プラン（plan）を優先できるようにする
        const planRaw = String(
          (normalized.plan && normalized.plan !== 'FREE' ? normalized.plan : userRecord?.plan) || normalized.plan || 'FREE'
        ).toUpperCase()

        const dailyLimit = getPersonaDailyLimitByUserPlan(planRaw)

        if (!isFreeHourActive && dailyLimit !== -1 && normalized.dailyUsage + 1 > dailyLimit) {
          return NextResponse.json(
            {
              error: '本日の生成上限に達しました。プロプランにアップグレードしてください。',
              code: 'DAILY_LIMIT_REACHED',
              usage: {
                dailyLimit,
                dailyUsed: normalized.dailyUsage,
                dailyRemaining: Math.max(0, dailyLimit - normalized.dailyUsage),
              },
              upgradeUrl: '/pricing',
            },
            { status: 429 }
          )
        }

        usageInfo = {
          dailyLimit: isFreeHourActive ? -1 : dailyLimit,
          dailyUsed: normalized.dailyUsage,
          dailyRemaining: isFreeHourActive || dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - normalized.dailyUsage),
          isFreeHour: isFreeHourActive,
        }
      } catch (e: any) {
        console.error('Persona usage limit check failed:', e)
      }
    }

    // URLからHTML取得（URLモードのみ）
    let meta: Record<string, string> = {}
    let headings: string[] = []
    let plainText = ''
    if (hasUrl) {
      let html = ''
      try {
        const fetchRes = await fetch(urlStr, {
          headers: { 'User-Agent': 'DoyaPersonaBot/1.0' },
          signal: AbortSignal.timeout(10000),
        })
        html = await fetchRes.text()
      } catch (e) {
        return NextResponse.json({ error: 'URLからコンテンツを取得できませんでした' }, { status: 400 })
      }
      meta = extractMetaTags(html)
      headings = extractHeadings(html)
      plainText = extractTextFromHTML(html)
    } else {
      // 詳細入力モード
      meta = {
        title: String(briefObj?.serviceName || serviceName || '不明'),
        description: String(briefObj?.serviceDescription || ''),
      }
      headings = []
      plainText = ''
    }

    const basePersonaJson =
      basePersona && typeof basePersona === 'object'
        ? JSON.stringify(basePersona).slice(0, 8000)
        : basePersona
        ? String(basePersona).slice(0, 8000)
        : ''
    const revisionText = revision ? String(revision).slice(0, 2000) : ''

    // ペルソナ生成プロンプト（クリエイティブは生成しない：要望）
    const prompt = `
あなたは超優秀なマーケティングコンサルタントです。
以下の情報から、ターゲットペルソナ（履歴書レベルの具体性）を生成してください。

${hasUrl ? `## サイト情報
- URL: ${urlStr}
- タイトル: ${meta.title || '不明'}
- 説明: ${meta.description || meta['og:description'] || '不明'}
- 見出し: ${headings.join(' / ')}
- コンテンツ抜粋: ${plainText.slice(0, 3000)}` : `## サイトURLがない場合（詳細入力）
以下の内容を最優先に解釈し、整合性のあるペルソナを作ってください。
- サービス名: ${String(briefObj?.serviceName || serviceName || '').slice(0, 200)}
- サービス内容: ${String(briefObj?.serviceDescription || '').slice(0, 1200)}
- 対象（誰向け）: ${String(briefObj?.target || '').slice(0, 600)}
- 提供価値（ベネフィット）: ${String(briefObj?.value || '').slice(0, 600)}
- 価格/プラン: ${String(briefObj?.pricing || '').slice(0, 400)}
- 競合/代替: ${String(briefObj?.competitors || '').slice(0, 400)}
- 差別化ポイント: ${String(briefObj?.differentiators || '').slice(0, 600)}
- 販売/集客チャネル: ${String(briefObj?.channels || '').slice(0, 400)}
- 補足: ${String(briefObj?.notes || '').slice(0, 800)}`}

${additionalInfo ? `## 追加情報\n${additionalInfo}` : ''}
${serviceName && hasUrl ? `## サービス名\n${serviceName}` : ''}
${basePersonaJson ? `## 現在のペルソナ（JSON）\n${basePersonaJson}` : ''}
${revisionText ? `## 変更したいポイント（ユーザー指示）\n${revisionText}` : ''}

## 出力形式（JSON）
以下の構造で **必ず有効なJSONのみ** を出力してください（Markdown不可）。
ユーザーが「この人、実在するのでは？」と錯覚するレベルで、生活/行動/思考を具体化してください。
${basePersonaJson && revisionText ? '重要: 上の「現在のペルソナ」を、ユーザー指示に沿って改善してください。既存の良い要素は残しつつ、矛盾なく更新してください。' : ''}
**チェックリスト（marketingChecklist）は不要です。絶対に出力しないでください。**
重要: dailySchedule の各項目は「短文」禁止。detail は最低でも **120〜240字** 程度で、下記を混ぜて“描写”してください。
- 具体行動（何をしているか）
- 使っているツール/媒体（例: Slack/Excel/GA4/スマホ等、職種に合うもの）
- その瞬間に考えていること/迷い/感情
- 場所・周囲の状況（家/オフィス/移動など）
- 次の行動へのつながり（なぜそれをするか）
また dailySchedule は **12〜18項目** で1日が自然に流れるように作成してください（起床→始業→昼→午後→帰宅→夜まで）。

{
  "analysis": {
    "siteSummary": "サイト/サービスの要点を3〜5文で要約（日本語）",
    "keyOffer": "誰の、どんな課題を、どう解決するか（1〜2文）",
    "targetHypothesis": "想定ターゲットの仮説（職種/状況/ニーズ）を具体的に",
    "whyThisPersona": "このペルソナになった理由（サイト情報/詳細入力の根拠と紐付けて説明）",
    "evidence": ["根拠1（見出し/本文/詳細入力の要素）", "根拠2", "根拠3"]
  },
  "persona": {
    "name": "架空の日本人名（フルネーム）",
    "age": 35,
    "gender": "男性/女性",
    "occupation": "職業（具体的に）",
    "industry": "所属業界（例: SaaS/小売/製造など）",
    "companySize": "会社規模（例: 10名/100名/1000名など）",
    "income": "年収帯",
    "location": "居住地",
    "familyStructure": "家族構成",
    "education": "学歴/専攻（任意）",
    "lifestyle": "ライフスタイルの特徴（具体）",
    "devices": ["使うデバイス/OS（例: iPhone/Android/Windows）"],
    "challenges": ["課題1", "課題2", "課題3"],
    "goals": ["目標1", "目標2"],
    "values": ["価値観/大事にすること"],
    "mediaUsage": ["よく使うメディア/SNS（具体）"],
    "searchKeywords": ["実際に検索しそうなクエリを5〜8個"],
    "purchaseMotivation": ["購買動機1", "購買動機2"],
    "objections": ["購入しない理由/反論"],
    "objectionHandling": ["反論をどう解消すれば買うか（3〜6個）"],
    "personalityTraits": ["性格特性1", "性格特性2"],
    "dayInLife": "1日の過ごし方の概要（200〜400字）",
    "quote": "ペルソナの口癖や価値観を表す一言",
    "dailySchedule": [
      {
        "time": "06:30",
        "title": "起床",
        "detail": "最低120〜240字。朝のルーティン・気持ち・スマホで見るもの・家族との会話などを含めた描写。",
        "mood": "気分（任意）",
        "imageCaption": "朝、整える",
        "sceneKeywords": ["朝", "自宅", "スマホ", "コーヒー", "静けさ"]
      },
      {
        "time": "09:15",
        "title": "業務開始",
        "detail": "最低120〜240字。どんなタスクを、どのツールで、何を気にして進めるかを具体的に。数字/上司/顧客など意思決定に関わる要素も入れる。",
        "mood": "…",
        "imageCaption": "今日も、数字と向き合う",
        "sceneKeywords": ["PC", "デスク", "ダッシュボード", "集中", "オフィス/自宅"]
      }
    ],
    "diary": {
      "title": "今日の日記タイトル（日本語）",
      "body": "600〜1200字程度の“日記”。生活感/悩み/意思決定/感情の揺れを具体的に。",
      "captionText": "画像に入れる短いテキスト（1〜2行/短め）",
      "sceneKeywords": ["日記の情景を表すキーワード（5〜10個）"]
    }
  }
}

重要: JSON以外は一切出力しないでください。
`

    const result = await geminiGenerateJson<PersonaResult>(prompt)

    // 成功時のみ使用回数を加算（1回=1生成）
    if (!disableLimits && isGuest && guestUsage) {
      const next = guestUsage.date === today ? guestUsage.count + 1 : 1
      guestUsage = { date: today, count: next }
      if (usageInfo) {
        usageInfo = {
          ...usageInfo,
          dailyUsed: next,
          dailyRemaining: usageInfo.dailyLimit === -1 ? -1 : Math.max(0, usageInfo.dailyLimit - next),
        }
      }
    } else if (!disableLimits && !isGuest && userId) {
      try {
        const updated = await prisma.userServiceSubscription.update({
          where: { userId_serviceId: { userId, serviceId: 'persona' } },
          data: {
            dailyUsage: { increment: 1 },
            monthlyUsage: { increment: 1 },
          },
        })
        if (usageInfo) {
          usageInfo = {
            ...usageInfo,
            dailyUsed: updated.dailyUsage,
            dailyRemaining:
              usageInfo.dailyLimit === -1 ? -1 : Math.max(0, usageInfo.dailyLimit - updated.dailyUsage),
          }
        }
      } catch (e: any) {
        console.error('Persona usage increment failed:', e)
      }
    }

    const res = NextResponse.json({
      success: true,
      data: result,
      meta: {
        url: hasUrl ? urlStr : undefined,
        title: meta.title,
        usage: usageInfo || undefined,
      },
    })

    if (!disableLimits && isGuest && guestUsage) {
      res.cookies.set(PERSONA_GUEST_USAGE_COOKIE, JSON.stringify(guestUsage), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 45, // 45日
      })
    }

    return res
  } catch (error) {
    console.error('Persona generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ペルソナ生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

