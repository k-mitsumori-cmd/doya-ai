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
              maxOutputTokens: 32768,
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
    industry: string
    companySize: string
    challenges: string[]
    goals: string[]
    mediaUsage: string[]
    purchaseMotivation: string[]
    objections: string[]
    personalityTraits: string[]
    dayInLife: string
    quote: string
    painPoints: Array<{ point: string; episode: string; imagePrompt?: string }>
    alternativeMethods: Array<{ method: string; dissatisfaction: string }>
    informationGathering: Array<{ source: string; behavior: string }>
    triggerEvents: string[]
    resonatingMessages: string[]
    innerVoice: string[]
    schedule: Array<{
      time: string
      activity: string
      detail: string
      mood: string
      imagePrompt?: string
    }>
    diary: {
      title: string
      content: string
      weather: string
      imageScenes: string[]
    }
  }
  deepDive: {
    objectionAnalysis: Array<{ objection: string; reassurance: string }>
    adoptionStory: {
      trigger: string
      competitors: string[]
      consultedPeople: string
      trialActivities: string
      decidingFactor: string
      timeline: Array<{ phase: string; description: string; imagePrompt?: string }>
    }
    dayWithService: string
  }
  summary: {
    oneLiner: string
    topChallenges: Array<{ rank: number; challenge: string; episode: string }>
    alternativesDissatisfaction: Array<{ alternative: string; dissatisfaction: string }>
    customerJourney: Array<{ phase: string; description: string }>
    decidingFactors: string[]
    catchphrases: string[]
    contentIdeas: Array<{ title: string; description: string }>
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
    const { url, additionalInfo, serviceName, existingPersona, modifications } = body

    // 修正モード: existingPersona + modifications がある場合
    const isModifyMode = !!existingPersona && !!modifications

    if (!isModifyMode && (!url || typeof url !== 'string')) {
      return NextResponse.json({ error: 'URLが必要です' }, { status: 400 })
    }

    // 認証チェック
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    let dailyLimit = PERSONA_PRICING.guestLimit
    let usedToday = 0
    let isUnlimited = false
    let isGuest = !userId

    if (userId) {
      // ログインユーザー
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, firstLoginAt: true },
      })

      if (user) {
        // 初回ログイン1時間無制限
        if (isWithinFreeHour(user.firstLoginAt)) {
          isUnlimited = true
        }

        dailyLimit = getPersonaDailyLimitByUserPlan(user.plan)
        if (dailyLimit < 0) isUnlimited = true

        // UserServiceSubscription で使用回数管理
        let sub = await prisma.userServiceSubscription.findUnique({
          where: { userId_serviceId: { userId, serviceId: 'persona' } },
        })

        if (!sub) {
          sub = await prisma.userServiceSubscription.create({
            data: { userId, serviceId: 'persona', plan: user.plan || 'FREE' },
          })
        }

        // 日次リセット
        if (shouldResetDailyUsage(sub.lastUsageReset)) {
          await prisma.userServiceSubscription.update({
            where: { id: sub.id },
            data: { dailyUsage: 0, lastUsageReset: new Date() },
          })
          usedToday = 0
        } else {
          usedToday = sub.dailyUsage || 0
        }
      }
    } else {
      // ゲスト: 無制限アクセス
      isUnlimited = true
    }

    // 制限チェック
    if (!isUnlimited && usedToday >= dailyLimit) {
      return NextResponse.json(
        {
          error: `本日の生成上限（${dailyLimit}回）に達しました`,
          limitReached: true,
          isGuest,
          usedToday,
          dailyLimit,
        },
        { status: 429 }
      )
    }

    let prompt: string
    let meta: Record<string, string> = {}

    if (isModifyMode) {
      // ===== 修正モード =====
      meta = {}
      prompt = `
あなたは超優秀なマーケティングコンサルタント兼ペルソナ設計の専門家です。
以下の既存ペルソナに対して、ユーザーの指示に従って変更を加えてください。

## 重要ルール
- ユーザーの変更指示に該当する部分のみを変更してください
- 変更指示に関係ない部分はそのまま維持してください
- 変更に伴い整合性が必要な場合は、関連する他のフィールドも調整してください
  （例: 年齢を変更した場合、日記やスケジュールの内容も年齢に合わせて微調整）
- 出力は既存と同じJSON構造で返してください

## 既存ペルソナデータ
${JSON.stringify(existingPersona, null, 2)}

## ユーザーの変更指示
${modifications}`
    } else {
      // ===== 新規生成モード =====
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

      meta = extractMetaTags(html)
      const headings = extractHeadings(html)
      const plainText = extractTextFromHTML(html)

      prompt = `
あなたは超優秀なマーケティングコンサルタント兼ペルソナ設計の専門家です。
以下のウェブサイト情報から、ターゲットペルソナとマーケティング施策を包括的に生成してください。

## サイト情報
- URL: ${url}
- タイトル: ${meta.title || '不明'}
- 説明: ${meta.description || meta['og:description'] || '不明'}
- 見出し: ${headings.join(' / ')}
- コンテンツ抜粋: ${plainText.slice(0, 3000)}

${additionalInfo ? `## 追加情報\n${additionalInfo}` : ''}
${serviceName ? `## サービス名\n${serviceName}` : ''}`
    }

    prompt += `

## 出力形式（JSON）
以下の構造で出力してください。売れる素材になるよう、具体的で実践的な内容にしてください。すべてのフィールドを必ず含めてください。

{
  "persona": {
    "name": "架空の日本人名（フルネーム）",
    "age": 35,
    "gender": "男性/女性",
    "occupation": "職業（具体的な役職まで）",
    "income": "年収帯",
    "location": "居住地",
    "familyStructure": "家族構成",
    "lifestyle": "ライフスタイルの特徴",
    "industry": "所属業界（例: IT/Web、製造業、小売業など）",
    "companySize": "会社規模（例: 従業員50名のスタートアップ）",
    "challenges": ["課題1", "課題2", "課題3"],
    "goals": ["目標1", "目標2"],
    "mediaUsage": ["よく使うメディア/SNS"],
    "purchaseMotivation": ["購買動機1", "購買動機2"],
    "objections": ["購入しない理由/反論"],
    "personalityTraits": ["性格特性1", "性格特性2"],
    "dayInLife": "1日の過ごし方の概要",
    "quote": "ペルソナの口癖や価値観を表す一言",
    "painPoints": [
      { "point": "具体的な課題/ペインポイント", "episode": "それが起きた具体的なエピソード（状況・感情を含む）", "imagePrompt": "A scene depicting this pain point in English for image generation" }
    ],
    "alternativeMethods": [
      { "method": "現在使っている代替手段", "dissatisfaction": "その手段への不満点" }
    ],
    "informationGathering": [
      { "source": "情報源（SNS名、メディア名、コミュニティ名など）", "behavior": "どのように情報を収集するか" }
    ],
    "triggerEvents": ["導入を検討するきっかけとなるイベント1", "イベント2", "イベント3"],
    "resonatingMessages": ["響くメッセージ・訴求ポイント1", "ポイント2"],
    "innerVoice": ["普段心の中で考えていること1（リアルな内面の声）", "考え2"],
    "schedule": [
      { "time": "6:00", "activity": "起床・朝のルーティン", "detail": "アラームで目覚め、まずスマホでニュースチェック。シャワーを浴びてコーヒーを淹れる。", "mood": "穏やか", "imagePrompt": "A Japanese person waking up in a modern bedroom, morning light" },
      { "time": "7:30", "activity": "通勤", "detail": "...", "mood": "普通" },
      { "time": "9:00", "activity": "仕事開始", "detail": "...", "mood": "集中" },
      { "time": "12:00", "activity": "ランチ", "detail": "...", "mood": "リラックス", "imagePrompt": "..." },
      { "time": "13:00", "activity": "午後の業務", "detail": "...", "mood": "集中" },
      { "time": "18:00", "activity": "退勤", "detail": "...", "mood": "解放感" },
      { "time": "19:00", "activity": "夕食・家族の時間", "detail": "...", "mood": "幸せ", "imagePrompt": "..." },
      { "time": "21:00", "activity": "自分の時間", "detail": "...", "mood": "リラックス" },
      { "time": "23:00", "activity": "就寝準備", "detail": "...", "mood": "穏やか" }
    ],
    "diary": {
      "title": "日記のタイトル（例：忙しかったけど充実した一日）",
      "content": "一人称（私/僕）で書いた200〜300字の日記。その日の出来事、感情、考えを自然な口語体で書く。ペルソナの性格や価値観が反映された内容にする。",
      "weather": "晴れ/曇り/雨など",
      "imageScenes": ["日記の内容を表す場面の英語描写1（画像生成用）", "日記の内容を表す場面の英語描写2（画像生成用）"]
    }
  },
  "deepDive": {
    "objectionAnalysis": [
      { "objection": "「でも…」と感じる不安や反論", "reassurance": "どんな情報・体験があれば安心して導入を決められるか" }
    ],
    "adoptionStory": {
      "trigger": "最初にサービスを知ったきっかけ",
      "competitors": ["比較検討した競合サービス名1", "競合2"],
      "consultedPeople": "社内で誰に相談したか（役職・関係性を含む）",
      "trialActivities": "トライアルで具体的に何を試したか",
      "decidingFactor": "最終的な決め手",
      "timeline": [
        { "phase": "認知", "description": "どこでサービスを知ったか", "imagePrompt": "A scene in English depicting how the persona first discovered the service" },
        { "phase": "興味", "description": "何に惹かれたか", "imagePrompt": "A scene depicting the persona getting interested and exploring the service website" },
        { "phase": "比較検討", "description": "競合と何を比べたか", "imagePrompt": "A scene of the persona comparing different services on their computer" },
        { "phase": "トライアル", "description": "無料トライアルで何をしたか", "imagePrompt": "A scene of the persona trying out the service for the first time" },
        { "phase": "社内稟議", "description": "どう説得したか", "imagePrompt": "A scene of the persona presenting or discussing with colleagues in a meeting" },
        { "phase": "本導入", "description": "導入の決め手", "imagePrompt": "A scene of the persona successfully using the service in their daily work, looking satisfied" }
      ]
    },
    "dayWithService": "このペルソナがサービスを実際に使う「ある1日」の描写。朝出社してから退社するまでの流れの中で、どのタイミングで・どう使い・どんな成果が出るかを具体的に（300〜500字）"
  },
  "summary": {
    "oneLiner": "ペルソナ概要の1行サマリー",
    "topChallenges": [
      { "rank": 1, "challenge": "最優先課題", "episode": "具体的エピソード" },
      { "rank": 2, "challenge": "2番目の課題", "episode": "具体的エピソード" },
      { "rank": 3, "challenge": "3番目の課題", "episode": "具体的エピソード" }
    ],
    "alternativesDissatisfaction": [
      { "alternative": "現在の代替手段", "dissatisfaction": "その不満点" }
    ],
    "customerJourney": [
      { "phase": "認知", "description": "どのようにサービスを知るか" },
      { "phase": "検討", "description": "何を比較検討するか" },
      { "phase": "トライアル", "description": "どう試すか" },
      { "phase": "導入", "description": "最終的にどう導入するか" }
    ],
    "decidingFactors": ["導入の決め手1", "決め手2", "決め手3"],
    "catchphrases": ["キャッチコピー1", "キャッチコピー2", "キャッチコピー3", "キャッチコピー4", "キャッチコピー5"],
    "contentIdeas": [
      { "title": "コンテンツ企画タイトル", "description": "概要説明" }
    ]
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

## 重要な指示
- scheduleは8〜10個の時間帯を含めてください。imagePromptは全体のうち3つだけに含め、その人の生活を表す印象的な場面を英語で記述してください。
- diaryは必ずペルソナの一人称で書いてください。imageScenes は2つ含めてください。
- painPointsは5つ以上、具体的なエピソード付きで記述してください。最初の3つにimagePromptを含めてください（その課題の場面を英語で描写）。
- alternativeMethodsは3つ以上記述してください。
- informationGatheringは4つ以上記述してください。
- triggerEventsは3つ以上記述してください。
- resonatingMessagesは5つ以上記述してください。
- innerVoiceは5つ以上、リアルな内面の声を記述してください。
- deepDive.objectionAnalysisは必ず10個記述してください。
- deepDive.adoptionStory.timelineは6段階で記述してください。全ステップにimagePromptを含めてください（各フェーズの場面を英語で具体的に描写）。
- deepDive.dayWithServiceは300〜500字で具体的に記述してください。
- summary.topChallengesは優先度順に3つ記述してください。
- summary.catchphrasesは5つ記述してください。
- summary.contentIdeasは3つ記述してください。
- summary.customerJourneyは認知→検討→トライアル→導入の4段階で記述してください。
- 重要: 必ず有効なJSONのみを出力してください。マークダウンや説明文は不要です。
`

    const result = await geminiGenerateJson<PersonaResult>(prompt)

    // 使用回数を更新
    if (userId) {
      await prisma.userServiceSubscription.updateMany({
        where: { userId, serviceId: 'persona' },
        data: { dailyUsage: { increment: 1 } },
      })
    }

    const response = NextResponse.json({
      success: true,
      data: result,
      meta: {
        url,
        title: meta.title,
        usedToday: usedToday + 1,
        dailyLimit,
        isGuest,
      },
    })

    return response
  } catch (error) {
    console.error('Persona generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ペルソナ生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

